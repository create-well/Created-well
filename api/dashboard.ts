/**
 * GET /api/dashboard
 *
 * Returns a full SyncData payload by merging:
 *   • Notion databases (MOVES → tasks, PEOPLE → stations, FLOWS → coflowDates, CONTENT → forum)
 *   • Supabase KV store (messages, braindumps, workshops, and all other non-Notion collections)
 *
 * Caching: none shared. The payload is per-user and session-gated, so the
 * response is private/no-store and there is no in-process payload cache.
 * Auth: a valid Supabase user session is required (see api/_auth.ts).
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
import { applyCors, requireSession } from './_auth.js';
import { hasDashboardConfiguration } from './_dashboard-config.js';
import { getSyncFreshness } from './_sync-engine.js';
import {
  normalizeMove,
  normalizePerson,
  peopleCareCounts,
  openAsksCareCounts,
  normalizeContent,
  normalizeFlow,
  normalizeMoney,
  normalizeEvent,
  normalizeFeedback,
  type NotionPage,
  type MoneyRecord,
  type EventRecord,
  type FeedbackRecord,
} from '../src/lib/notionNormalizer.js';
import type { SyncData } from '../src/app/components/api';

// ── Supabase KV helpers ───────────────────────────────────────────────────────

const KV_TABLE = 'kv_store_dabe1c74';

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

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // The payload is internal data; a valid user session is required.
  if (!(await requireSession(req, res))) return;

  // An unconfigured source is unknown, never a successfully empty source.
  if (!hasDashboardConfiguration(process.env)) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(503).json({ error: 'Dashboard sources are not configured' });
    return;
  }

  const secret     = process.env.NOTION_SECRET;
  const dbMoves    = process.env.NOTION_DB_MOVES;
  const dbPeople   = process.env.NOTION_DB_PEOPLE;
  const dbFlows    = process.env.NOTION_DB_FLOWS;
  const dbContent  = process.env.NOTION_DB_CONTENT;
  const dbMoney    = process.env.NOTION_DB_MONEY;
  const dbOpenAsks = process.env.NOTION_DB_OPEN_ASKS;
  const dbEvents   = process.env.NOTION_DB_EVENTS;
  const dbFeedback = process.env.NOTION_DB_FEEDBACK;

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
    // Configuration was checked above; configured empty sources remain valid.
    const [notionResults, kvResults] = await Promise.all([
      Promise.all([
        secret && dbMoves   ? queryNotionDatabase(dbMoves, secret)   : Promise.resolve([]),
        secret && dbPeople  ? queryNotionDatabase(dbPeople, secret)  : Promise.resolve([]),
        secret && dbFlows   ? queryNotionDatabase(dbFlows, secret)   : Promise.resolve([]),
        secret && dbContent ? queryNotionDatabase(dbContent, secret) : Promise.resolve([]),
        secret && dbMoney   ? queryNotionDatabase(dbMoney, secret)   : Promise.resolve([]),
        secret && dbOpenAsks ? queryNotionDatabase(dbOpenAsks, secret) : Promise.resolve([]),
        secret && dbEvents   ? queryNotionDatabase(dbEvents, secret)   : Promise.resolve([]),
        secret && dbFeedback ? queryNotionDatabase(dbFeedback, secret) : Promise.resolve([]),
      ]),
      Promise.all(KV_KEYS.map(k => kvGetList(k))),
    ]);

    const [movesPages, peoplePages, flowsPages, contentPages, moneyPages, openAsksPages, eventsPages, feedbackPages] = notionResults;
    const [
      messages, braindumps, announcements, forumReplies,
      workshops, workshopPrograms, workshopResources,
      coflowCheckins, wellNotes, calendarEvents,
    ] = kvResults;

    const payload: SyncData = {
      // Notion-backed
      tasks:             movesPages.map(normalizeMove),
      stations:          peoplePages.map(normalizePerson),
      peopleCare:        peopleCareCounts(peoplePages),
      openAsksCare:      openAsksCareCounts(openAsksPages),
      forum:             contentPages.map(normalizeContent),
      coflowDates:       flowsPages.map(normalizeFlow),
      money:             moneyPages.map(normalizeMoney) as MoneyRecord[],
      events:            eventsPages.map(normalizeEvent) as EventRecord[],
      feedback:          feedbackPages.map(normalizeFeedback) as FeedbackRecord[],
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

    // Sync freshness from delivery state (reader decision, 2026-10-27):
    // the same computed block /api/snapshot serves, attached here so the
    // dashboard's freshness line derives from real sync state instead of
    // self-reporting "not verified". getSyncFreshness is fail-soft per
    // source (a store problem reads "unknown"), so this never fails the
    // payload.
    const syncFreshness = {
      generatedAt: new Date().toISOString(),
      sources: await getSyncFreshness(Date.now()),
    };

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ...payload, syncFreshness });
  } catch (err) {
    console.error('[/api/dashboard] Error building payload:', err);
    res.status(503).json({
      error: 'Failed to build dashboard payload',
    });
  }
}
