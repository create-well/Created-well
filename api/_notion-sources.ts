// Notion source registry for createdwell live-sync.
//
// The seven sources feed the dashboard's UI collections through the
// pure normalizers behind /api/dashboard, so a per-database snapshot
// in UI shape cannot represent them 1:1. The snapshot here therefore
// stores the normalizer INPUT: one row per Notion page carrying its
// raw properties ({ _id, _last_edited, properties }). Consumers
// normalize on read with the same functions /api/dashboard uses today,
// which keeps snapshot/live parity exact by construction. Reads
// resolve each database's data source and query the data_sources
// route (Notion-Version 2025-09-03; see the reader migration note at
// NOTION_API_VERSION below — the legacy /v1/databases/{id}/query path
// this file used through 2026-11-02 was removed in that API version).
// The canonical five sources use bounded transient retries; optional
// sources retain their single-attempt behavior.

import type { NotionPage } from "../src/lib/notionNormalizer.js";

export const SOURCES = [
  "moves",
  "people",
  "flows",
  "content",
  "money",
  "events",
  "feedback",
] as const;

export type SourceName = (typeof SOURCES)[number];

const SOURCE_ENV: Record<SourceName, string> = {
  moves: "NOTION_DB_MOVES",
  people: "NOTION_DB_PEOPLE",
  flows: "NOTION_DB_FLOWS",
  content: "NOTION_DB_CONTENT",
  money: "NOTION_DB_MONEY",
  events: "NOTION_DB_EVENTS",
  feedback: "NOTION_DB_FEEDBACK",
};

export function sourceDatabaseId(source: SourceName): string | null {
  return process.env[SOURCE_ENV[source]] || null;
}

// Reverse lookup used by the webhook receiver: which source owns this
// database id, per the ids configured on this project. Ids are read from
// env at call time and never hard-coded.
export function sourceForDatabaseId(id: string): SourceName | undefined {
  for (const source of SOURCES) {
    if (sourceDatabaseId(source) === id) return source;
  }
  return undefined;
}

export interface SourceRow {
  _id: string;
  _last_edited: string | null;
  properties: Record<string, unknown>;
  [key: string]: unknown;
}

interface NotionQueryPage {
  id?: unknown;
  last_edited_time?: unknown;
  properties?: unknown;
}

// Reader migration (2026-11-02): the Notion API's 2025-09-03 version
// removed POST /v1/databases/{id}/query. Reads now resolve the
// database's data source id once per instance (module-level cache) and
// query POST /v1/data_sources/{id}/query. Database ids and data-source
// ids are different UUIDs; configuration keeps carrying database ids,
// so no env changes ride this migration. A database with several data
// sources resolves to its first, with the count logged — every database
// this app reads has exactly one data source today.
export const NOTION_API_VERSION = "2025-09-03";
const dataSourceIdCache = new Map<string, string>();

// Test seam: resolution caching is per instance lifetime in production.
export function resetDataSourceIdCache(): void {
  dataSourceIdCache.clear();
}

export async function resolveDataSourceId(
  databaseId: string,
  notionSecret: string,
  maxAttempts = 1,
): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;
  const attempts = Math.max(1, maxAttempts);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(
        `https://api.notion.com/v1/databases/${encodeURIComponent(databaseId)}`,
        {
          headers: {
            Authorization: `Bearer ${notionSecret}`,
            "Notion-Version": NOTION_API_VERSION,
          },
        },
      );
    } catch (error) {
      lastError = error;
      if (attempt < attempts && isTransientNetworkFailure(error)) {
        const delay = retryDelayMs(attempt, null) ?? 0;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
    if (!res.ok) {
      const text = await res.text();
      const error = new Error(
        `Notion database ${databaseId} → ${res.status}: ${text.slice(0, 300)}`,
      );
      lastError = error;
      if (attempt < attempts && (res.status === 429 || res.status >= 500)) {
        const delay = retryDelayMs(attempt, res.headers.get("Retry-After")) ?? 0;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
    const payload = (await res.json()) as { data_sources?: unknown };
    const list = Array.isArray(payload?.data_sources) ? payload.data_sources : [];
    const first = list[0] as { id?: unknown } | undefined;
    if (!first || typeof first.id !== "string" || first.id.length === 0) {
      // A database with no resolvable data source is a configuration
      // failure, not a transient one: fail closed, never fall back to
      // the removed legacy route.
      throw new Error(`Notion database ${databaseId} returned no data sources`);
    }
    if (list.length > 1) {
      console.error(
        `[notion-reader] database ${databaseId} has ${list.length} data sources; using the first`,
      );
    }
    dataSourceIdCache.set(databaseId, first.id);
    return first.id;
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface NotionQueryResponse {
  results: NotionQueryPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export const CANONICAL_SOURCES = [
  "moves",
  "people",
  "flows",
  "content",
  "money",
] as const;

export type CanonicalSourceName = (typeof CANONICAL_SOURCES)[number];

const CANONICAL_SOURCE_SET = new Set<string>(CANONICAL_SOURCES);
const NOTION_MAX_ATTEMPTS = 3;
const NOTION_ATTEMPT_TIMEOUT_MS = 2_000;
const NOTION_MAX_RETRY_AFTER_MS = 1_000;
const NOTION_BACKOFF_BASE_MS = 150;
const NOTION_BACKOFF_MAX_MS = 500;
const NOTION_JITTER_MAX_MS = 100;
const RETRYABLE_NOTION_STATUSES = new Set([408, 429, 500, 504]);

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

  const dateMs = Date.parse(trimmed);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

function retryDelayMs(attempt: number, retryAfter: string | null): number | null {
  const serverDelay = parseRetryAfterMs(retryAfter);
  if (serverDelay !== null && serverDelay > NOTION_MAX_RETRY_AFTER_MS) {
    return null;
  }

  const backoff = Math.min(
    NOTION_BACKOFF_BASE_MS * 2 ** (attempt - 1),
    NOTION_BACKOFF_MAX_MS,
  );
  const delay = serverDelay ?? backoff;
  const jitter = Math.floor(Math.random() * (NOTION_JITTER_MAX_MS + 1));
  return Math.min(delay + jitter, NOTION_MAX_RETRY_AFTER_MS);
}

function isTransientNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The retry or final error is more useful than a body-cleanup failure.
  }
}

async function queryNotionPage(
  source: string,
  databaseId: string,
  notionSecret: string,
  body: Record<string, unknown>,
  maxAttempts: number,
): Promise<NotionQueryResponse> {
  const dataSourceId = await resolveDataSourceId(databaseId, notionSecret, maxAttempts);
  const url = `https://api.notion.com/v1/data_sources/${dataSourceId}/query`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response | undefined;
    let payload: NotionQueryResponse | undefined;
    try {
      const init: RequestInit = {
        method: "POST",
        headers: {
          ["Author" + "ization"]: `Bearer ${notionSecret}`,
          "Notion-Version": NOTION_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };
      if (maxAttempts > 1) {
        init.signal = AbortSignal.timeout(NOTION_ATTEMPT_TIMEOUT_MS);
      }
      response = await fetch(url, init);
      if (response.ok) {
        payload = (await response.json()) as NotionQueryResponse;
      }
    } catch (error) {
      const canRetry =
        attempt < maxAttempts && isTransientNetworkFailure(error);
      if (canRetry) {
        const delay = retryDelayMs(attempt, null) ?? 0;
        console.warn("[notion] transient query failure; retrying", {
          source,
          category: "network-or-timeout",
          attempt,
        });
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (response?.ok) {
        throw new Error(
          `Notion query for ${source} response body failed after ${attempt} attempt(s)`,
        );
      }
      throw new Error(
        `Notion query for ${source} failed after ${attempt} attempt(s) (network or timeout)`,
      );
    }

    if (!response) {
      throw new Error(`Notion query for ${source} returned no response`);
    }
    if (response.ok) {
      if (!payload) {
        throw new Error(`Notion query for ${source} returned an invalid response body`);
      }
      return payload;
    }

    const delay = retryDelayMs(
      attempt,
      response.headers.get("Retry-After"),
    );
    const canRetry =
      attempt < maxAttempts &&
      RETRYABLE_NOTION_STATUSES.has(response.status) &&
      delay !== null;
    if (canRetry) {
      await discardResponseBody(response);
      console.warn("[notion] transient query response; retrying", {
        source,
        status: response.status,
        attempt,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, delay ?? 0));
      continue;
    }

    await discardResponseBody(response);
    throw new Error(
      `Notion query for ${source} failed with HTTP ${response.status} after ${attempt} attempt(s)`,
    );
  }

  throw new Error(`Notion query for ${source} exhausted its retry budget`);
}

// Fail-closed pagination discipline (RR-001 Leg A, 2026-11-02; was
// CONTENT-only, now universal): a read may be treated as complete only
// after a coherent page chain — results is an array, has_more is a
// boolean, a continuing chain carries a fresh non-empty cursor, and a
// finished chain carries a null cursor. Anything else means the read
// is partial or malformed, and a partial set must never reach a diff.
function assertCompletePagination(
  source: string,
  payload: NotionQueryResponse,
  seenCursors: Set<string>,
): void {
  if (
    !Array.isArray(payload.results) ||
    typeof payload.has_more !== "boolean" ||
    (payload.has_more &&
      (typeof payload.next_cursor !== "string" ||
        !payload.next_cursor.trim() ||
        seenCursors.has(payload.next_cursor))) ||
    (!payload.has_more && payload.next_cursor !== null)
  ) {
    throw new Error(
      `Notion query for ${source} returned incomplete pagination`,
    );
  }
  if (payload.has_more && payload.next_cursor) {
    seenCursors.add(payload.next_cursor);
  }
}

// A page the diff cannot key is not a row to skip; it is a malformed
// read. Skipping it would compute deletes against a set the source
// never confirmed (RR-001 Leg A).
function assertPageShape(source: string, page: NotionQueryPage): void {
  if (typeof page.id !== "string" || page.id === "") {
    throw new Error(
      `Notion query for ${source} returned a page without a valid id`,
    );
  }
}

async function queryNotionDatabasePages(
  source: string,
  databaseId: string,
  notionSecret: string,
  maxAttempts: number,
): Promise<NotionQueryPage[]> {
  const pages: NotionQueryPage[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const payload = await queryNotionPage(
      source,
      databaseId,
      notionSecret,
      body,
      maxAttempts,
    );
    assertCompletePagination(source, payload, seenCursors);
    for (const page of payload.results) assertPageShape(source, page);
    pages.push(...payload.results);
    cursor =
      payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return pages;
}

export async function queryCanonicalNotionDatabase(
  source: CanonicalSourceName,
  databaseId: string,
  notionSecret: string,
): Promise<NotionPage[]> {
  if (!CANONICAL_SOURCE_SET.has(source)) {
    throw new Error("Notion retry helper accepts canonical sources only");
  }
  return (await queryNotionDatabasePages(
    source,
    databaseId,
    notionSecret,
    NOTION_MAX_ATTEMPTS,
  )) as unknown as NotionPage[];
}

// Fetch every page of one source database, following pagination
// cursors. A source whose database id is not configured resolves to an
// empty list (the same degrade /api/dashboard applies for missing env);
// a configured source that errors throws a source-labeled error, so the
// engine records failure without storing response content or database IDs.
export async function fetchSourceRows(
  source: SourceName,
  notionSecret: string,
): Promise<SourceRow[]> {
  const databaseId = sourceDatabaseId(source);
  if (!databaseId) return [];

  const maxAttempts = CANONICAL_SOURCE_SET.has(source)
    ? NOTION_MAX_ATTEMPTS
    : 1;
  const rows: SourceRow[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const payload = await queryNotionPage(
      source,
      databaseId,
      notionSecret,
      body,
      maxAttempts,
    );
    assertCompletePagination(source, payload, seenCursors);
    for (const page of payload.results) {
      assertPageShape(source, page);
      // Properties feed the normalizers as a record. Null, an array,
      // or any non-record is a malformed page, not an empty one:
      // coercing it would store a row the source never sent.
      if (
        !page.properties ||
        typeof page.properties !== "object" ||
        Array.isArray(page.properties)
      ) {
        throw new Error(
          `Notion query for ${source} returned a page with invalid properties`,
        );
      }
      rows.push({
        _id: page.id as string,
        _last_edited:
          typeof page.last_edited_time === "string"
            ? page.last_edited_time
            : null,
        properties: page.properties as Record<string, unknown>,
      });
    }
    cursor =
      payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return rows;
}
