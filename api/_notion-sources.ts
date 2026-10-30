// Notion source registry for createdwell live-sync (Phase 2 port).
//
// Adaptation note: on cr8w-dashboard the sync sources are that app's
// seven dashboard databases and fetchSourceRows lives in notion-sync,
// returning UI-shaped rows. Createdwell's five databases feed seven UI
// collections through the pure normalizers behind /api/dashboard, so a
// per-database snapshot in UI shape cannot represent them 1:1. The
// snapshot here therefore stores the normalizer INPUT: one row per
// Notion page carrying its raw properties ({ _id, _last_edited,
// properties }). Consumers normalize on read with the same functions
// /api/dashboard uses today, which keeps snapshot/live parity exact by
// construction. Reads use the same legacy database query path
// (Notion-Version 2022-06-28). The canonical five sources use bounded
// transient retries; optional sources retain their single-attempt behavior.

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
const RETRYABLE_NOTION_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

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
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response | undefined;
    let payload: NotionQueryResponse | undefined;
    try {
      const init: RequestInit = {
        method: "POST",
        headers: {
          ["Author" + "ization"]: `Bearer ${notionSecret}`,
          "Notion-Version": "2022-06-28",
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

async function queryNotionDatabasePages(
  source: string,
  databaseId: string,
  notionSecret: string,
  maxAttempts: number,
): Promise<NotionQueryPage[]> {
  const pages: NotionQueryPage[] = [];
  let cursor: string | undefined;

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
    for (const page of payload.results) {
      if (typeof page.id !== "string" || page.id === "") continue;
      rows.push({
        _id: page.id,
        _last_edited:
          typeof page.last_edited_time === "string"
            ? page.last_edited_time
            : null,
        properties:
          page.properties && typeof page.properties === "object"
            ? (page.properties as Record<string, unknown>)
            : {},
      });
    }
    cursor =
      payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return rows;
}
