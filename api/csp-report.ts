// POST /api/csp-report — collector for the Report-Only CSP's violation
// reports (packet: CSP violation collector, 2026-11-13).
//
// Route posture (named, deliberate):
// - POST only; anything else is a 405. No auth: browsers deliver CSP
//   reports unauthenticated by design, so the untrusted-input handling
//   below is the control, not a credential.
// - No CORS grant of its own, and vercel.json carves this route out of
//   the platform /api CORS entry: report delivery does not use CORS,
//   and a grant here would only invite scripted abuse.
// - Content-Type allowlist (the two report shapes, plus application/
//   json tolerated because some Reporting API stacks label it so); any
//   other type is a 415 and nothing is read or stored.
// - Hard body cap; an over-cap body is a 413 before any parsing.
// - Accepted shapes always answer 204 with no body, including a body
//   that fails to parse (count nothing) and a store failure (logged by
//   class server-side). Nothing from the request is ever reflected in
//   any response, on any path.
// - Storage is the deduped, capped ring in _csp-reports.ts: a report
//   folds into an existing (directive, blocked host) entry as a hit
//   count, so volume raises counts instead of rows. The merge is a
//   read-modify-write; counts are best-effort under concurrency, which
//   is the right trade for an observation collector.

import {
  extractReports,
  mergeSamples,
} from "./_csp-reports.js";
import {
  createSupabaseCspReportStore,
  type CspReportStore,
} from "./_csp-report-store.js";

// Raw-body reading (below) needs the platform's JSON parser off, the
// same shape as api/notion-webhook.ts.
export const config = { api: { bodyParser: false } };

// Reports run about a kilobyte; the cap exists to refuse abuse, not to
// fit a legitimate payload, so it sits far above any real report.
export const MAX_BODY_BYTES = 64 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/reports+json",
  "application/json",
]);

const LOG_PREFIX = "[csp-report]";

interface CspRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
}

interface CspResponse {
  status: (code: number) => CspResponse;
  setHeader?: (name: string, value: string) => void;
  end: () => void;
  json?: (body: unknown) => void;
}

function contentTypeOf(req: CspRequest): string {
  const raw = req.headers?.["content-type"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").split(";")[0].trim().toLowerCase();
}

async function readBody(
  req: CspRequest,
): Promise<{ body: Buffer } | { error: "too-large" }> {
  if (typeof req[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      total += buf.length;
      if (total > MAX_BODY_BYTES) return { error: "too-large" };
      chunks.push(buf);
    }
    return { body: Buffer.concat(chunks) };
  }
  if (typeof req.body === "string") {
    const buf = Buffer.from(req.body);
    return buf.length > MAX_BODY_BYTES ? { error: "too-large" } : { body: buf };
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.length > MAX_BODY_BYTES
      ? { error: "too-large" }
      : { body: req.body };
  }
  if (req.body !== undefined && req.body !== null) {
    const buf = Buffer.from(JSON.stringify(req.body));
    return buf.length > MAX_BODY_BYTES ? { error: "too-large" } : { body: buf };
  }
  return { body: Buffer.alloc(0) };
}

export async function handleCspReport(
  req: CspRequest,
  res: CspResponse,
  store: CspReportStore,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).end();
    return;
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentTypeOf(req))) {
    res.status(415).end();
    return;
  }
  const read = await readBody(req);
  if ("error" in read) {
    res.status(413).end();
    return;
  }
  let payload: unknown = null;
  try {
    payload = JSON.parse(read.body.toString("utf8"));
  } catch {
    // A malformed body counts nothing and still answers 204: the
    // sender is a browser's reporting machinery, not a client that can
    // act on an error, and an error code here would only invite noise.
    res.status(204).end();
    return;
  }
  const samples = extractReports(payload);
  if (samples.length > 0) {
    try {
      const ring = await store.read();
      await store.write(mergeSamples(ring, samples, new Date().toISOString()));
    } catch (err) {
      console.error(
        `${LOG_PREFIX} store fold failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  res.status(204).end();
}

export default async function handler(
  req: CspRequest,
  res: CspResponse,
): Promise<void> {
  await handleCspReport(req, res, createSupabaseCspReportStore());
}
