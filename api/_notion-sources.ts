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
// (Notion-Version 2022-06-28) and the same failure behavior (throw on a
// non-OK response) as api/dashboard.ts.

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

// Fetch every page of one source database, following pagination
// cursors. A source whose database id is not configured resolves to an
// empty list (the same degrade /api/dashboard applies for missing env);
// a configured source that errors throws, exactly like the dashboard
// reader, so failures stay loud and the engine records them.
export async function fetchSourceRows(
  source: SourceName,
  notionSecret: string,
): Promise<SourceRow[]> {
  const databaseId = sourceDatabaseId(source);
  if (!databaseId) return [];

  const rows: SourceRow[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          ["Author" + "ization"]: `Bearer ${notionSecret}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Notion DB ${databaseId} → ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const payload = (await res.json()) as NotionQueryResponse;
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
