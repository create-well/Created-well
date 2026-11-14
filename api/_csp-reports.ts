// Pure core for the CSP violation collector (packet: CSP violation
// collector, 2026-11-13). The Report-Only policy's reports land in the
// dashboard KV store as a capped, deduped ring so the observation phase
// produces data the lanes can read, instead of violations living only
// in browser consoles.
//
// Everything here is pure: payload extraction for both report shapes
// (legacy report-uri and the Reporting API), the ring merge with its
// dedupe + cap posture, and the tolerant decode of a stored ring. The
// store and the route live in _csp-report-store.ts and csp-report.ts.
//
// Payloads are untrusted input. Extraction keeps a minimum field set,
// strips query strings and fragments from every stored URI (they can
// carry tokens and personal data), and truncates samples, so the ring's
// total size is bounded by construction: at most CSP_RING_CAP entries,
// each with short string fields only.

export interface CspReportSample {
  // First token of the effective directive (falling back to the
  // violated directive), lowercased: "img-src", never the full value.
  directive: string;
  // Blocked URI with query and fragment stripped, truncated.
  blockedUri: string;
  // Host of the blocked URI, or the special token itself for the
  // non-URL cases browsers report ("inline", "eval", "data", "blob").
  blockedHost: string;
  // Document URI with query and fragment stripped, truncated.
  documentUri: string;
  disposition: string;
  statusCode: number;
}

export interface CspRingEntry extends CspReportSample {
  hits: number;
  firstSeen: string;
  lastSeen: string;
}

export interface CspReportRing {
  entries: CspRingEntry[];
}

export const CSP_RING_CAP = 100;

const MAX_SAMPLE_CHARS = 256;
const MAX_DIRECTIVE_CHARS = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripQueryAndFragment(uri: string): string {
  const cut = uri.search(/[?#]/);
  return cut === -1 ? uri : uri.slice(0, cut);
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function cleanUri(value: unknown): string {
  return truncate(stripQueryAndFragment(asString(value).trim()), MAX_SAMPLE_CHARS);
}

function blockedHostOf(blockedUri: string): string {
  if (!blockedUri) return "";
  try {
    const host = new URL(blockedUri).host;
    if (host) return truncate(host, MAX_SAMPLE_CHARS);
  } catch {
    // Not a URL: fall through to the token shapes below.
  }
  // "inline" and "eval" arrive bare; "data:..." and "blob:..." arrive
  // as scheme-prefixed values the URL parser may reject in odd forms.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(blockedUri);
  if (scheme) return scheme[1].toLowerCase();
  return truncate(blockedUri, MAX_SAMPLE_CHARS);
}

function directiveOf(effective: unknown, violated: unknown): string {
  const raw = asString(effective).trim() || asString(violated).trim();
  if (!raw) return "unknown";
  return truncate(raw.split(/\s+/)[0].toLowerCase(), MAX_DIRECTIVE_CHARS);
}

function statusCodeOf(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function sampleOf(fields: {
  effective: unknown;
  violated: unknown;
  blocked: unknown;
  document: unknown;
  disposition: unknown;
  statusCode: unknown;
}): CspReportSample {
  const blockedUri = cleanUri(fields.blocked);
  return {
    directive: directiveOf(fields.effective, fields.violated),
    blockedUri,
    blockedHost: blockedHostOf(blockedUri),
    documentUri: cleanUri(fields.document),
    disposition: asString(fields.disposition).trim() === "enforce" ? "enforce" : "report",
    statusCode: statusCodeOf(fields.statusCode),
  };
}

// Legacy shape (report-uri): { "csp-report": { "document-uri": ...,
// "blocked-uri": ..., "effective-directive": ..., ... } }
export function extractLegacyReport(payload: unknown): CspReportSample[] {
  if (!isRecord(payload) || !isRecord(payload["csp-report"])) return [];
  const report = payload["csp-report"];
  return [
    sampleOf({
      effective: report["effective-directive"],
      violated: report["violated-directive"],
      blocked: report["blocked-uri"],
      document: report["document-uri"],
      disposition: report["disposition"],
      statusCode: report["status-code"],
    }),
  ];
}

// Reporting API shape: an array of report objects whose body carries
// camelCase fields ({ type: "csp-violation", body: { documentURL,
// blockedURL, effectiveDirective, ... } }). A single bare object is
// tolerated. Non-CSP report types in the array are skipped.
export function extractReportingApiReports(payload: unknown): CspReportSample[] {
  const items = Array.isArray(payload) ? payload : isRecord(payload) ? [payload] : [];
  const samples: CspReportSample[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (typeof item.type === "string" && item.type !== "csp-violation") continue;
    const body = isRecord(item.body) ? item.body : item;
    samples.push(
      sampleOf({
        effective: body.effectiveDirective,
        violated: body.violatedDirective,
        blocked: body.blockedURL,
        document: body.documentURL ?? item.url,
        disposition: body.disposition,
        statusCode: body.statusCode,
      }),
    );
  }
  return samples;
}

// Dispatch on the parsed payload's own shape, so the route accepts
// either delivery generation without trusting the Content-Type beyond
// its allowlist gate.
export function extractReports(payload: unknown): CspReportSample[] {
  if (Array.isArray(payload)) return extractReportingApiReports(payload);
  if (isRecord(payload) && isRecord(payload["csp-report"])) {
    return extractLegacyReport(payload);
  }
  return extractReportingApiReports(payload);
}

function ringKey(sample: CspReportSample): string {
  return `${sample.directive}\n${sample.blockedHost}`;
}

// Fold samples into the ring. An existing (directive, blocked host)
// pair increments its hit count and refreshes its sample fields and
// lastSeen; a new pair appends. When the ring would exceed the cap,
// the least-recently-seen entries are evicted — a noisy page raises
// counts on existing entries instead of flooding the store, and a
// flood of distinct pairs cannot grow the store past the cap.
export function mergeSamples(
  ring: CspReportRing,
  samples: CspReportSample[],
  nowIso: string,
): CspReportRing {
  const entries = ring.entries.map((entry) => ({ ...entry }));
  const byKey = new Map(entries.map((entry) => [ringKey(entry), entry]));
  for (const sample of samples) {
    const key = ringKey(sample);
    const existing = byKey.get(key);
    if (existing) {
      existing.hits += 1;
      existing.lastSeen = nowIso;
      existing.blockedUri = sample.blockedUri;
      existing.documentUri = sample.documentUri;
      existing.disposition = sample.disposition;
      existing.statusCode = sample.statusCode;
    } else {
      const entry: CspRingEntry = {
        ...sample,
        hits: 1,
        firstSeen: nowIso,
        lastSeen: nowIso,
      };
      entries.push(entry);
      byKey.set(key, entry);
    }
  }
  while (entries.length > CSP_RING_CAP) {
    let oldest = 0;
    for (let i = 1; i < entries.length; i += 1) {
      if (entries[i].lastSeen < entries[oldest].lastSeen) oldest = i;
    }
    const [evicted] = entries.splice(oldest, 1);
    byKey.delete(ringKey(evicted));
  }
  return { entries };
}

// Tolerant decode of a stored ring: malformed entries drop, counts and
// timestamps are coerced to safe values, and anything unrecognizable
// decodes to an empty ring — the collector self-heals on its next
// write rather than wedging on a corrupt value.
export function validateRing(raw: unknown): CspReportRing {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { entries: [] };
    }
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return { entries: [] };
  const entries: CspRingEntry[] = [];
  for (const item of parsed.entries) {
    if (!isRecord(item)) continue;
    const sample = sampleOf({
      effective: item.directive,
      violated: undefined,
      blocked: item.blockedUri,
      document: item.documentUri,
      disposition: item.disposition,
      statusCode: item.statusCode,
    });
    // Preserve the stored host rather than re-deriving it: a stored
    // sample was already cleaned at extraction time.
    if (typeof item.blockedHost === "string" && item.blockedHost) {
      sample.blockedHost = truncate(item.blockedHost, MAX_SAMPLE_CHARS);
    }
    entries.push({
      ...sample,
      hits:
        typeof item.hits === "number" && item.hits > 0 ? Math.trunc(item.hits) : 1,
      firstSeen: asString(item.firstSeen) || asString(item.lastSeen),
      lastSeen: asString(item.lastSeen) || asString(item.firstSeen),
    });
    if (entries.length >= CSP_RING_CAP) break;
  }
  return { entries };
}
