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
import { createClient } from '@supabase/supabase-js';
import {
  normalizeMove,
  normalizePerson,
  normalizeContent,
  normalizeFlow,
  normalizeMoney,
  type NotionPage,
} from '../src/lib/notionNormalizer.js';
import type { SyncData } from '../src/app/components/api.js';
import { getNotionConfig } from './_notionConfig.js';
import { KV_TABLE, SYNC_POLICY } from '../src/config/sync.js';

// ── Supabase KV helpers ───────────────────────────────────────────────────────

// KV_TABLE imported from config/sync.js

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function kvGetList(key: string): Promise<unknown[]> {
  const { data, error } = await supabaseClient()
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

// Fetch all pages from a Notion database, following pagination cursors.
async function queryNotionDatabase(databaseId: string, secret: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion DB ${databaseId} → ${res.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await res.json()) as NotionQueryResponse;
    pages.push(...payload.results);
    cursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return pages;
}

// ── In-process cache (warm-start optimisation; CDN cache is the primary gate) ─

interface CacheEntry {
  payload: SyncData;
  ts: number;
}

let cache: CacheEntry | null = null;
const PROCESS_CACHE_TTL = SYNC_POLICY.CACHE_TTL_MS; // slightly under CDN 60s

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Serve from in-process cache if still fresh and not forcing refresh
  const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
  if (!forceRefresh && cache && Date.now() - cache.ts < PROCESS_CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.setHeader('X-Cache', 'HIT');
    res.json(cache.payload);
    return;
  }

  const { secret, databaseIds } = getNotionConfig();
  const {
    tasks: dbMoves,
    stations: dbPeople,
    'coflow-dates': dbFlows,
    forum: dbContent,
    money: dbMoney,
  } = databaseIds;

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
    // Fan-out: all Notion DB queries + all KV reads in parallel.
    // Missing env vars resolve to empty arrays — never a hard failure.
    const [notionResults, kvResults] = await Promise.all([
      Promise.all([
        secret && dbMoves   ? queryNotionDatabase(dbMoves, secret)   : Promise.resolve([]),
        secret && dbPeople  ? queryNotionDatabase(dbPeople, secret)  : Promise.resolve([]),
        secret && dbFlows   ? queryNotionDatabase(dbFlows, secret)   : Promise.resolve([]),
        secret && dbContent ? queryNotionDatabase(dbContent, secret) : Promise.resolve([]),
        secret && dbMoney   ? queryNotionDatabase(dbMoney, secret)   : Promise.resolve([]),
      ]),
      Promise.all(KV_KEYS.map(k => kvGetList(k))),
    ]);

    const [movesPages, peoplePages, flowsPages, contentPages, moneyPages] = notionResults;
    const [
      messages, braindumps, announcements, forumReplies,
      workshops, workshopPrograms, workshopResources,
      coflowCheckins, wellNotes, calendarEvents,
    ] = kvResults;

    const payload: SyncData = {
      // Notion-backed
      tasks:             movesPages.map(normalizeMove),
      stations:          peoplePages.map(normalizePerson),
      forum:             contentPages.map(normalizeContent),
      coflowDates:       flowsPages.map(normalizeFlow),
      money:             moneyPages.map(normalizeMoney),
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
    };

    cache = { payload, ts: Date.now() };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('[/api/dashboard] Error building payload:', err);
    res.status(503).json({
      error: 'Failed to build dashboard payload',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
