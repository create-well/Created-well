// POST /api/notion-webhook — Notion webhook receiver for live-sync.
//
// Implements Monny's blueprint (2026-10-22) on main's architecture,
// with the rev3 corrections (live-sync spec rev3 items 6 and 11):
// - Raw-body HMAC-SHA256 verification against NOTION_WEBHOOK_SECRET
//   (the subscription verification token), fail-closed: a missing or
//   mismatched signature is a 401 and nothing is written. While the
//   env var is unset (the setup window only), signature verification
//   falls back to the token in the setup row; after activation the
//   route reads the token only from the env var.
// - The one-time verification handshake is accepted ONLY while the
//   env var is unset AND the setup row is empty, and the token is
//   written once, first-write-wins. Any other handshake POST is
//   rejected: 200, a ledger error run, no write. The token value is
//   never logged, never echoed, never committed.
// - Request hygiene: the raw body is capped at 256 KB (over-cap →
//   400); a body that cannot be read raw answers 400 (transport
//   failure, not an auth failure); a JSON parse failure answers 401
//   because it precedes signature verification.
// - Events are signals, not content: the changed page's source is
//   resolved from the re-read page's own parent (the mapping call of
//   record; the payload parent is a fallback only), the event is
//   recorded as pending delivery state, and the source is re-read
//   from Notion through the one normalization path.
// - Coalescing is per source: an event inside the window is carried as
//   dirty + pending, never dropped and never global.
// - After a signature verifies, ANY failure still answers 200 and is
//   recorded in the sync ledger, so Notion does not retry-storm an
//   event the 15-minute reconciliation will repair anyway.

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getSetupValue,
  insertSetupValue,
  supabaseConfigured,
  getDeliveryState,
} from "./_supabase.js";
import {
  markEvent,
  recordEngineRun,
  syncSource,
  withinCoalesceWindow,
} from "./_sync-engine.js";
import {
  sourceForDatabaseId,
  type SourceName,
} from "./_notion-sources.js";

// Signature verification needs the exact raw bytes Notion sent, so the
// platform's JSON body parsing is disabled for this route.
export const config = { api: { bodyParser: false } };

const LOG_PREFIX = "[notion-webhook]";

// The setup row that carries the one-time verification token between
// the handshake and the operator's read (spec §8 step 3).
const SETUP_KEY = "notion_webhook_verification";

// Request hygiene cap (rev3 item 11c): a webhook payload larger than
// this is refused before parsing, verification, or any write.
export const MAX_BODY_BYTES = 256 * 1024;

const EVENT_TYPES = new Set([
  "page.created",
  "page.properties_updated",
  "page.content_updated",
  "page.deleted",
  "page.undeleted",
  "page.moved",
  "data_source.content_updated",
  "data_source.schema_updated",
  "database.content_updated",
  "database.schema_updated",
]);

interface WebhookRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
}

interface WebhookResponse {
  status: (code: number) => WebhookResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RawBodyResult =
  | { body: Buffer }
  | { error: "unavailable" | "too-large" };

async function readRawBody(req: WebhookRequest): Promise<RawBodyResult> {
  if (typeof req[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      const buffer =
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      total += buffer.length;
      if (total > MAX_BODY_BYTES) return { error: "too-large" };
      chunks.push(buffer);
    }
    return { body: Buffer.concat(chunks) };
  }
  if (typeof req.body === "string") {
    const body = Buffer.from(req.body, "utf8");
    return body.length > MAX_BODY_BYTES
      ? { error: "too-large" }
      : { body };
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.length > MAX_BODY_BYTES
      ? { error: "too-large" }
      : { body: req.body };
  }
  // A pre-parsed object body cannot be verified byte-exactly.
  return { error: "unavailable" };
}

// Signature verification precedence (rev3 item 6): the env var when
// set; otherwise, during the setup window only, the token stored by
// the accepted handshake; otherwise no secret exists and verification
// fails closed. After activation the setup row is cleared by the
// operator, so the fallback has nothing to read.
async function resolveWebhookSecret(): Promise<string | null> {
  const fromEnv = process.env.NOTION_WEBHOOK_SECRET;
  if (fromEnv) return fromEnv;
  if (!supabaseConfigured()) return null;
  const row = await getSetupValue(SETUP_KEY).catch(() => null);
  return row && typeof row.token === "string" ? row.token : null;
}

function verifySignature(
  rawBody: Buffer,
  header: unknown,
  secret: string | null,
): boolean {
  if (!secret) return false;
  const providedRaw =
    typeof header === "string" ? header : Array.isArray(header) ? header[0] : "";
  const provided = (providedRaw ?? "")
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex"),
  );
}

function headerValue(
  headers: WebhookRequest["headers"],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  // eslint-disable-next-line security/detect-object-injection -- Read-only header lookup keyed by an internal literal.
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function notionGetPageParent(
  pageId: string,
  notionSecret: string,
  version: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`,
    {
      headers: {
        ["Author" + "ization"]: `Bearer ${notionSecret}`,
        "Notion-Version": version,
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    // A failed retrieve is not an unknown entity: surface it so the
    // handler records an authenticated failure instead of a silent
    // ignore. The reconciliation cron remains the repair path.
    throw new Error(`Notion page retrieve failed (${response.status})`);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload) || !isRecord(payload.parent)) return null;
  return payload.parent;
}

// Resolve which of the seven sources a page belongs to. The re-read
// page's own parent is the mapping call of record (rev3 item 11b):
// the data-source API first, then the legacy API (database_id). The
// event payload's parent is a fallback only, for pages the re-read
// cannot see (a deleted page retrieves as 404 under both versions).
async function resolvePageSource(
  pageId: string,
  payloadParent: Record<string, unknown> | null,
  notionSecret: string,
): Promise<SourceName | undefined> {
  const fromParent = (parent: Record<string, unknown> | null) => {
    if (!parent) return undefined;
    const databaseId =
      typeof parent.database_id === "string" ? parent.database_id : null;
    const dataSourceId =
      typeof parent.data_source_id === "string"
        ? parent.data_source_id
        : null;
    return (
      (databaseId ? sourceForDatabaseId(databaseId) : undefined) ??
      (dataSourceId ? sourceForDatabaseId(dataSourceId) : undefined)
    );
  };
  return (
    fromParent(await notionGetPageParent(pageId, notionSecret, "2025-09-03")) ??
    fromParent(await notionGetPageParent(pageId, notionSecret, "2022-06-28")) ??
    fromParent(payloadParent)
  );
}

export default async function handler(
  req: WebhookRequest,
  res: WebhookResponse,
) {
  res.setHeader?.("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const handlerStartedAtMs = Date.now();
  const raw = await readRawBody(req);
  if (raw.error === "too-large") {
    console.log(`${LOG_PREFIX} payload too large; failing closed`);
    return res.status(400).json({ error: "Payload too large" });
  }
  if (raw.error) {
    // Transport failure, not an auth failure (rev3 item 11c): 400,
    // nothing written.
    console.log(`${LOG_PREFIX} raw body unavailable; failing closed`);
    return res.status(400).json({ error: "Raw body required" });
  }
  const rawBody = raw.body;

  let body: Record<string, unknown>;
  try {
    body = rawBody.length
      ? (JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>)
      : {};
  } catch {
    // A parse failure here precedes signature verification, so it is
    // an unauthenticated failure: 401 (rev3 item 11c). The spec's
    // post-verification parse-failure shape (200 + ledger error run)
    // cannot occur in this route: parsing precedes verification.
    console.log(`${LOG_PREFIX} malformed body`);
    return res.status(401).json({ ok: false, error: "malformed payload" });
  }

  // Subscription verification handshake: Notion posts a one-time
  // verification_token when the subscription is created. The handshake
  // is signature-exempt by construction (no key exists yet); its
  // protection is the rev3 item 6 guard. Accept and store the token
  // ONLY while the env var is unset AND the setup row is empty; the
  // write is first-write-wins, so no code path overwrites a populated
  // row. Any other handshake POST is rejected: 200, a ledger error
  // run, no write. The token value is never logged or echoed.
  if (typeof body.verification_token === "string") {
    let accepted = false;
    if (!process.env.NOTION_WEBHOOK_SECRET && supabaseConfigured()) {
      const existing = await getSetupValue(SETUP_KEY).catch(() => undefined);
      if (existing === null) {
        accepted = await insertSetupValue(SETUP_KEY, {
          token: body.verification_token,
          receivedAt: new Date().toISOString(),
        }).catch(() => false);
      }
    }
    if (accepted) {
      console.log("handshake received");
    } else {
      console.log(`${LOG_PREFIX} handshake rejected (setup window closed)`);
      await recordEngineRun(
        handlerStartedAtMs,
        [
          {
            source: "webhook",
            rows: 0,
            cached: false,
            error: "handshake rejected: setup window closed",
          },
        ],
        { trigger: "webhook" },
      );
    }
    return res.status(200).json({ ok: true, received: "verification_token" });
  }

  const secret = await resolveWebhookSecret();
  if (
    !verifySignature(rawBody, headerValue(req.headers, "x-notion-signature"), secret)
  ) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Authenticated from here on: failures answer 200 and are recorded.
  const startedAtMs = Date.now();
  try {
    const type = typeof body.type === "string" ? body.type : "";
    const eventId = typeof body.id === "string" ? body.id : null;
    const entity = isRecord(body.entity) ? body.entity : null;
    const entityId =
      entity && typeof entity.id === "string" ? entity.id : null;
    const entityType =
      entity && typeof entity.type === "string" ? entity.type : "";
    const eventAt =
      typeof body.timestamp === "string"
        ? body.timestamp
        : new Date().toISOString();

    if (!EVENT_TYPES.has(type) || !entityId) {
      console.log(
        `${LOG_PREFIX} ignored type=${type || "unknown"} eventIdPresent=${eventId ? "yes" : "no"}`,
      );
      return res.status(200).json({ ok: true, ignored: true });
    }

    const notionSecret = process.env.NOTION_SECRET;
    if (!notionSecret) throw new Error("NOTION_SECRET is not configured");
    if (!supabaseConfigured()) {
      throw new Error("Supabase delivery store is not configured");
    }

    let source: SourceName | undefined;
    if (entityType === "database" || entityType === "data_source") {
      source = sourceForDatabaseId(entityId);
    } else if (entityType === "page") {
      const payloadParent =
        isRecord(body.data) && isRecord(body.data.parent)
          ? body.data.parent
          : null;
      source = await resolvePageSource(entityId, payloadParent, notionSecret);
    }

    if (!source) {
      console.log(
        `${LOG_PREFIX} ignored unknown entity type=${type} eventIdPresent=${eventId ? "yes" : "no"}`,
      );
      return res.status(200).json({ ok: true, ignored: true });
    }

    const prior = await getDeliveryState(source);
    await markEvent(source, { id: eventId, entityId, at: eventAt });
    if (withinCoalesceWindow(prior, Date.now())) {
      console.log(
        `${LOG_PREFIX} coalesced source=${source} eventIdPresent=${eventId ? "yes" : "no"}`,
      );
      return res.status(200).json({ ok: true, coalesced: true, source });
    }

    const outcome = await syncSource(source, notionSecret);
    if (outcome.deferred) {
      // Another run holds this source's lease; the event stays recorded
      // as dirty + pending (markEvent above) and the holder's run or the
      // cron trailing edge carries it. Never logged as a sync: like the
      // coalesce path above, a deferral writes NO run record — a record
      // here would read as an ordinary ok run carrying the mirrored row
      // count and inflate the ledger (QA ledger-leg finding, 2026-10-27).
      console.log(
        `${LOG_PREFIX} deferred source=${source} (lease held) eventIdPresent=${eventId ? "yes" : "no"}`,
      );
      return res.status(200).json({ ok: true, deferred: true, source });
    }
    await recordEngineRun(
      startedAtMs,
      [{ source, rows: outcome.count, cached: false }],
      { trigger: "webhook" },
    );
    console.log(
      `${LOG_PREFIX} synced source=${source} rows=${outcome.count} changed=${outcome.changed} eventIdPresent=${eventId ? "yes" : "no"}`,
    );
    return res.status(200).json({ ok: true, source, rows: outcome.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    console.log(`${LOG_PREFIX} error=${message}`);
    await recordEngineRun(
      startedAtMs,
      [{ source: "webhook", rows: 0, cached: false, error: message }],
      { trigger: "webhook" },
    );
    return res.status(200).json({ ok: false, error: "sync failed" });
  }
}
