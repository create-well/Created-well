/**
 * GET /api/dashboard
 *
 * Returns a full SyncData payload by merging:
 *   • Notion databases (MOVES → tasks, PEOPLE → stations, FLOWS → coflowDates, CONTENT → forum)
 *   • Supabase KV store (messages, braindumps, workshops, and all other non-Notion collections)
 *
 * Caching: CDN s-maxage=60 + in-process 55s cache so Notion is never hit more than ~once/min.
 * Secrets: NOTION_SECRET and all DB IDs live here only — never in the client bundle.
 *
 * Required env vars (set in Vercel dashboard):
 *   NOTION_SECRET         — Notion integration token (secret_...)
 *   NOTION_DB_MOVES       — MOVES database ID
 *   NOTION_DB_PEOPLE      — PEOPLE database ID
 *   NOTION_DB_FLOWS       — FLOWS database ID  (the only dated table)
 *   NOTION_DB_CONTENT     — CONTENT database ID
 *   NOTION_DB_MONEY       — MONEY database ID  (read-only for now; writes deferred to Phase 2)
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service-role key (server-only)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  normalizeMove,
  normalizePerson,
  normalizeContent,
  normalizeFlow,
  buildRelationIndex,
  type NotionPage,
} from '../src/lib/notionNormalizer.js';
import type { SyncData, SourceReport, SyncMeta } from '../src/types/contract.js';

// ── Supabase KV helpers ───────────────────────────────────────────────────────

const KV_TABLE = 'kv_store_dabe1c74';

// Loaded lazily for the same reason as api/server: a top-level import of
// @supabase/supabase-js turns any resolution failure into
// FUNCTION_INVOCATION_FAILED with no body, killing every route in the file.
async function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

async function kvGetList(key: string, client: Awaited<ReturnType<typeof supabaseClient>>): Promise<unknown[]> {
  const { data, error } = await client
    .from(KV_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`KV read error for "${key}": ${error.message}`);
  const raw = data?.value;
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) return raw;
    return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
  } catch {
    return [];
  }
}

// ── Notion query ──────────────────────────────────────────────────────────────

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

const NOTION_LEGACY_VERSION = '2022-06-28';
const NOTION_DS_VERSION     = '2025-09-03';

/**
 * Notion now distinguishes a database from its data sources, and the two ids are
 * different values. For MOVES, the database is 3da8c564... and its single data
 * source is 5597e583..., and each one is rejected by the other's endpoint. Rather
 * than making the env vars depend on knowing which is which, accept either:
 *
 *   1. POST /v1/databases/:id/query      (legacy, database id)
 *   2. POST /v1/data_sources/:id/query   (current, data source id)
 *   3. GET  /v1/databases/:id -> data_sources[0].id, then query that
 *
 * The path that worked is reported in meta.sources so the response says which
 * id shape is configured, instead of leaving it to be guessed.
 */
async function notionPost(
  path: string,
  version: string,
  secret: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: NotionQueryResponse | null; text: string }> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Notion-Version': version,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, json: null, text: (await res.text()).slice(0, 300) };
  return { ok: true, status: res.status, json: (await res.json()) as NotionQueryResponse, text: '' };
}

async function paginate(
  path: string,
  version: string,
  secret: string,
): Promise<{ pages: NotionPage[] } | { error: string; status: number }> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await notionPost(path, version, secret, body);
    if (!r.ok || !r.json) return { error: r.text, status: r.status };
    pages.push(...r.json.results);
    cursor = r.json.has_more && r.json.next_cursor ? r.json.next_cursor : undefined;
  } while (cursor);
  return { pages };
}

async function queryNotionDatabase(
  id: string,
  secret: string,
): Promise<{ pages: NotionPage[]; via: string }> {
  // 1. Treat the id as a database id on the legacy endpoint.
  const legacy = await paginate(`/databases/${id}/query`, NOTION_LEGACY_VERSION, secret);
  if ('pages' in legacy) return { pages: legacy.pages, via: 'database id' };

  // 2. Treat it as a data source id.
  const ds = await paginate(`/data_sources/${id}/query`, NOTION_DS_VERSION, secret);
  if ('pages' in ds) return { pages: ds.pages, via: 'data source id' };

  // 3. Resolve the database to its first data source, then query that.
  const meta = await fetch(`https://api.notion.com/v1/databases/${id}`, {
    headers: { Authorization: `Bearer ${secret}`, 'Notion-Version': NOTION_DS_VERSION },
  });
  if (meta.ok) {
    const body = (await meta.json()) as { data_sources?: Array<{ id: string; name?: string }> };
    const first = body.data_sources?.[0]?.id;
    if (first) {
      const resolved = await paginate(`/data_sources/${first}/query`, NOTION_DS_VERSION, secret);
      if ('pages' in resolved) return { pages: resolved.pages, via: `resolved data source ${first}` };
      throw new Error(`Notion ${id} -> data source ${first} -> ${resolved.status}: ${resolved.error}`);
    }
  }

  throw new Error(
    `Notion ${id}: database query ${legacy.status} (${legacy.error}); ` +
    `data source query ${ds.status} (${ds.error})`,
  );
}

// ── In-process cache (warm-start optimisation; CDN cache is the primary gate) ─

interface CacheEntry {
  payload: SyncData;
  ts: number;
}

let cache: CacheEntry | null = null;
const PROCESS_CACHE_TTL = 55_000; // slightly under CDN 60s

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Serve from in-process cache if still fresh
  if (cache && Date.now() - cache.ts < PROCESS_CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.setHeader('X-Cache', 'HIT');
    res.json(cache.payload);
    return;
  }

  const secret     = process.env.NOTION_SECRET;
  const dbMoves    = process.env.NOTION_DB_MOVES;
  const dbPeople   = process.env.NOTION_DB_PEOPLE;
  const dbFlows    = process.env.NOTION_DB_FLOWS;
  const dbContent  = process.env.NOTION_DB_CONTENT;

  // Every section reports where it came from and whether it actually arrived.
  // A missing env var used to resolve to an empty array indistinguishable from
  // "this database has no rows", which is how an empty dashboard looked healthy
  // for weeks. Now it is reported as 'unconfigured' and the client shows stale.
  const sources: Record<string, SourceReport> = {};

  async function loadNotion(
    section: string,
    label: string,
    dbId: string | undefined,
    envVar: string,
  ): Promise<NotionPage[]> {
    if (!secret) {
      sources[section] = { source: label, status: 'unconfigured', rows: 0, detail: 'NOTION_SECRET is not set' };
      return [];
    }
    if (!dbId) {
      sources[section] = { source: label, status: 'unconfigured', rows: 0, detail: `${envVar} is not set` };
      return [];
    }
    try {
      const { pages, via } = await queryNotionDatabase(dbId, secret);
      sources[section] = { source: `${label} (${via})`, status: 'ok', rows: pages.length };
      return pages;
    } catch (err) {
      sources[section] = {
        source: label,
        status: 'error',
        rows: 0,
        detail: err instanceof Error ? err.message.slice(0, 200) : String(err),
      };
      return [];
    }
  }

  // KV keys for data not yet migrated to Notion
  const KV_KEYS = [
    'cr8w_messages',
    'cr8w_braindumps',
    'cr8w_announcements',
    'cr8w_forum_replies',
    'cr8w_workshops',
    'cr8w_workshop_programs',
    'cr8w_workshop_resources',
    'cr8w_coflow_checkins',
    'cr8w_well_notes',
    'cr8w_calendar_events',
  ] as const;

  try {
    const kv = await supabaseClient();

    // Fan-out: all Notion DB queries + all KV reads in parallel. Nothing in here
    // throws; each section records its own outcome in `sources`.
    const [notionResults, kvResults] = await Promise.all([
      Promise.all([
        loadNotion('tasks',       'Notion MOVES',   dbMoves,   'NOTION_DB_MOVES'),
        loadNotion('stations',    'Notion PEOPLE',  dbPeople,  'NOTION_DB_PEOPLE'),
        loadNotion('coflowDates', 'Notion FLOWS',   dbFlows,   'NOTION_DB_FLOWS'),
        loadNotion('forum',       'Notion CONTENT', dbContent, 'NOTION_DB_CONTENT'),
      ]),
      Promise.all(KV_KEYS.map(async (k) => {
        const section = k.replace(/^cr8w_/, '');
        try {
          const list = await kvGetList(k, kv);
          sources[section] = { source: `Supabase ${KV_TABLE}`, status: 'ok', rows: list.length };
          return list;
        } catch (err) {
          sources[section] = {
            source: `Supabase ${KV_TABLE}`,
            status: 'error',
            rows: 0,
            detail: err instanceof Error ? err.message.slice(0, 200) : String(err),
          };
          return [];
        }
      })),
    ]);

    const [movesPages, peoplePages, flowsPages, contentPages] = notionResults;
    const [
      messages, braindumps, announcements, forumReplies,
      workshops, workshopPrograms, workshopResources,
      coflowCheckins, wellNotes, calendarEvents,
    ] = kvResults;

    // Relations return page IDs. Index PEOPLE and FLOWS first so Owner, Person,
    // Flow, and Flow Keeper resolve to names instead of rendering as UUIDs.
    const peopleIndex = buildRelationIndex(peoplePages);
    const flowsIndex  = buildRelationIndex(flowsPages);

    const meta: SyncMeta = {
      generatedAt: new Date().toISOString(),
      degraded: Object.values(sources).some(s => s.status !== 'ok'),
      sources,
    };

    const payload: SyncData = {
      // Notion-backed
      tasks:             movesPages.map(page => normalizeMove(page, peopleIndex, flowsIndex)),
      stations:          peoplePages.map(normalizePerson),
      forum:             contentPages.map(page => normalizeContent(page, flowsIndex)),
      coflowDates:       flowsPages.map(page => normalizeFlow(page, peopleIndex)),
      // KV-backed (passed through; typed by trust — these were written by our own API)
      messages:          messages          as SyncData['messages'],
      braindumps:        braindumps        as SyncData['braindumps'],
      announcements:     announcements     as SyncData['announcements'],
      forumReplies:      forumReplies      as SyncData['forumReplies'],
      workshops:         workshops         as SyncData['workshops'],
      workshopPrograms:  workshopPrograms  as SyncData['workshopPrograms'],
      workshopResources: workshopResources as SyncData['workshopResources'],
      coflowCheckins:    coflowCheckins    as SyncData['coflowCheckins'],
      wellNotes:         wellNotes         as SyncData['wellNotes'],
      calendarEvents:    calendarEvents    as SyncData['calendarEvents'],
      meta,
    };

    cache = { payload, ts: Date.now() };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Data-Degraded', meta.degraded ? '1' : '0');
    res.json(payload);
  } catch (err) {
    console.error('[/api/dashboard] Error building payload:', err);
    res.status(503).json({
      error: 'Failed to build dashboard payload',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
