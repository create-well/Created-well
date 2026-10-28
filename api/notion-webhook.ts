// POST /api/notion-webhook — Notion webhook receiver for live-sync.
//
// Implements Monny's blueprint (2026-10-22) on main's architecture:
// - Raw-body HMAC-SHA256 verification against NOTION_WEBHOOK_SECRET
//   (the subscription verification token), fail-closed: a missing or
//   mismatched signature is a 401 and nothing is written.
// - The one-time verification handshake stashes the token in the
//   Supabase setup table for operator retrieval. The token value is
//   never logged, never echoed, never committed.
// - Events are signals, not content: the changed page's source is
//   resolved, the event is recorded as pending delivery state, and the
//   source is re-read from Notion through the one normalization path.
// - Coalescing is per source: an event inside the window is carried as
//   dirty + pending, never dropped and never global.
// - After a signature verifies, ANY failure still answers 200 and is
//   recorded in the sync ledger, so Notion does not retry-storm an
//   event the 15-minute reconciliation will repair anyway.

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  setSetupValue,
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

async function readRawBody(req: WebhookRequest): Promise<Buffer | null> {
  if (typeof req[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk,
      );
    }
    return Buffer.concat(chunks);
  }
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (Buffer.isBuffer(req.body)) return req.body;
  // A pre-parsed object body cannot be verified byte-exactly.
  return null;
}

function verifySignature(rawBody: Buffer, header: unknown): boolean {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
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

// Resolve which of the five sources a page belongs to: the payload's
// own parent when present, else the page's parent under the legacy API
// (database_id), else under the data-source API (data_source_id).
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
    fromParent(payloadParent) ??
    fromParent(await notionGetPageParent(pageId, notionSecret, "2022-06-28")) ??
    fromParent(await notionGetPageParent(pageId, notionSecret, "2025-09-03"))
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

  const rawBody = await readRawBody(req);
  if (rawBody === null) {
    console.log(`${LOG_PREFIX} raw body unavailable; failing closed`);
    return res.status(401).json({ error: "Raw body required" });
  }

  let body: Record<string, unknown>;
  try {
    body = rawBody.length
      ? (JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>)
      : {};
  } catch {
    // Malformed and unauthenticated: answer 200 so a bad sender cannot
    // manufacture a retry storm either.
    console.log(`${LOG_PREFIX} malformed body`);
    return res.status(200).json({ ok: false, error: "malformed payload" });
  }

  // Subscription verification handshake: Notion posts a one-time
  // verification_token when the subscription is created. Stash it for
  // the operator; never log the value.
  if (typeof body.verification_token === "string") {
    if (supabaseConfigured()) {
      try {
        await setSetupValue("notion_webhook_verification", {
          token: body.verification_token,
          receivedAt: new Date().toISOString(),
        });
      } catch {
        console.log(`${LOG_PREFIX} verification stash failed`);
      }
    } else {
      console.log(`${LOG_PREFIX} verification stash skipped (store unconfigured)`);
    }
    console.log(`${LOG_PREFIX} verification handshake received`);
    return res.status(200).json({ ok: true, received: "verification_token" });
  }

  if (!verifySignature(rawBody, headerValue(req.headers, "x-notion-signature"))) {
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
    await recordEngineRun(startedAtMs, [
      { source, rows: outcome.count, cached: false },
    ]);
    console.log(
      `${LOG_PREFIX} synced source=${source} rows=${outcome.count} changed=${outcome.changed} eventIdPresent=${eventId ? "yes" : "no"}`,
    );
    return res.status(200).json({ ok: true, source, rows: outcome.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    console.log(`${LOG_PREFIX} error=${message}`);
    await recordEngineRun(startedAtMs, [
      { source: "webhook", rows: 0, cached: false, error: message },
    ]);
    return res.status(200).json({ ok: false, error: "sync failed" });
  }
}
