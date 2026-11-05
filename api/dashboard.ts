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
 *   NOTION_DB_MONEY       — MONEY database ID  (read here; writes land through POST /api/server/money)
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service-role key (server-only)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyCors, requireSession } from './_auth.js';
import { hasDashboardConfiguration } from './_dashboard-config.js';
import { getSyncFreshness } from './_sync-engine.js';
import { queryCanonicalNotionDatabase, resolveDataSourceId, NOTION_API_VERSION } from './_notion-sources.js';
import { validateKvSlice } from './_kv-validation.js';
import {
  normalizeMove,
  buildOwnerSlugIndex,
  normalizePerson,
  peopleCareCounts,
  openAsksCareCounts,
  normalizeContent,
  normalizeFlow,
  buildFlowPartifulLinks,
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
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through to the corrupt refusal */ }
  // F-SWEEP2-1: a corrupt KV value must not read as an empty list. The
  // fan-out settle wrapper catches this throw, degrades only this
  // collection's slice, and names kv:<key> in sourceErrors; the error
  // message carries the collection and the failure class to the log.
  throw new Error(`KV list "${key}" is corrupt (unparseable); not treating it as empty`);
}

// ── Notion query ──────────────────────────────────────────────────────────────

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// Fetch all pages from a Notion database, following pagination cursors.
async function queryNotionDatabase(databaseId: string, secret: string): Promise<NotionPage[]> {
  // Reader migration (2026-11-02): query the data_sources route
  // (Notion-Version 2025-09-03); the legacy databases query route was
  // removed in that API version.
  const dataSourceId = await resolveDataSourceId(databaseId, secret);
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Notion-Version': NOTION_API_VERSION,
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
    'cr8w_decisions',
  ] as const;

  try {
    // Fan-out: all Notion DB queries + all KV reads in parallel, settled
    // per source (F-FANOUT). A failing query degrades only its own slice
    // to empty and the failure is named in `sourceErrors` on the payload;
    // it no longer 503s the whole dashboard. Retries for the canonical
    // sources already ran inside their query; this is the catch after
    // retries are exhausted. Configuration was checked above; configured
    // empty sources remain valid.
    const settleNamed = async <T>(name: string, run: () => Promise<T[]>): Promise<{ values: T[]; error?: string }> => {
      try {
        return { values: await run() };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[/api/dashboard] Source ${name} failed; slice degraded to empty:`, message);
        return { values: [], error: message };
      }
    };

    const notionSettled = await Promise.all([
      settleNamed('moves',   () => secret && dbMoves   ? queryCanonicalNotionDatabase('moves', dbMoves, secret)   : Promise.resolve([])),
      settleNamed('people',  () => secret && dbPeople  ? queryCanonicalNotionDatabase('people', dbPeople, secret)  : Promise.resolve([])),
      settleNamed('flows',   () => secret && dbFlows   ? queryCanonicalNotionDatabase('flows', dbFlows, secret)   : Promise.resolve([])),
      settleNamed('content', () => secret && dbContent ? queryCanonicalNotionDatabase('content', dbContent, secret) : Promise.resolve([])),
      settleNamed('money',   () => secret && dbMoney   ? queryCanonicalNotionDatabase('money', dbMoney, secret)   : Promise.resolve([])),
      // Optional sources retain their existing single-attempt query path.
      settleNamed('openAsks', () => secret && dbOpenAsks ? queryNotionDatabase(dbOpenAsks, secret) : Promise.resolve([])),
      settleNamed('events',   () => secret && dbEvents   ? queryNotionDatabase(dbEvents, secret)   : Promise.resolve([])),
      settleNamed('feedback', () => secret && dbFeedback ? queryNotionDatabase(dbFeedback, secret) : Promise.resolve([])),
    ]);
    const kvSettled = await Promise.all(
      KV_KEYS.map((k) => settleNamed(`kv:${k}`, () => kvGetList(k))),
    );

    const sourceErrors: Record<string, string> = {};
    for (const [name, settled] of [
      ...notionSettled.map((s, i) => [['moves', 'people', 'flows', 'content', 'money', 'openAsks', 'events', 'feedback'][i], s] as const),
      ...kvSettled.map((s, i) => [`kv:${KV_KEYS[i]}`, s] as const),
    ]) {
      if (settled.error) sourceErrors[name] = settled.error;
    }

    const [movesPages, peoplePages, flowsPages, contentPages, moneyPages, openAsksPages, eventsPages, feedbackPages] =
      notionSettled.map((s) => s.values);
    const ownerSlugIndex = buildOwnerSlugIndex(peoplePages);
    // KV boundary validation: stored rows are checked at this read
    // boundary instead of being passed through on trust. A malformed
    // row is dropped, the valid rows are served, and the drop is named
    // in sourceErrors under the slice's kv: key. A slice whose read
    // already failed keeps its read error and stays empty.
    const kvValidated = kvSettled.map((s, i) => {
      if (s.error) return s.values;
      const { values, dropped } = validateKvSlice(KV_KEYS[i], s.values);
      if (dropped > 0) {
        sourceErrors[`kv:${KV_KEYS[i]}`] =
          `KV validation dropped ${dropped} malformed record(s); valid records served`;
      }
      return values;
    });
    const [
      messages, braindumps, announcements, forumReplies,
      workshops, workshopPrograms, workshopResources,
      coflowCheckins, wellNotes, calendarEvents, decisions,
    ] = kvValidated;

    // Partiful RSVP links, projected once for the whole payload
    // (register 1484, Leg 1): flow page id -> the link of its first
    // related EVENTS row carrying one.
    const partifulLinks = buildFlowPartifulLinks(flowsPages, eventsPages);

    const payload: SyncData = {
      // Notion-backed
      // MOVES Owner is a Relation → PEOPLE: resolve the first target
      // through the PEOPLE pages loaded alongside (multi-owner rule and
      // fallback semantics live with buildOwnerSlugIndex).
      tasks:             movesPages.map((pg) => normalizeMove(pg, ownerSlugIndex)),
      stations:          peoplePages.map(normalizePerson),
      peopleCare:        peopleCareCounts(peoplePages),
      openAsksCare:      openAsksCareCounts(openAsksPages),
      forum:             contentPages.map(normalizeContent),
      // The Partiful link projects through each flow's Events relation
      // (register 1484, Leg 1); every other flow field is normalizeFlow's.
      coflowDates:       flowsPages.map((pg) => {
        const d = normalizeFlow(pg);
        const partifulLink = partifulLinks.get(pg.id);
        return partifulLink ? { ...d, partifulLink } : d;
      }),
      money:             moneyPages.map(normalizeMoney) as MoneyRecord[],
      events:            eventsPages.map(normalizeEvent) as EventRecord[],
      feedback:          feedbackPages.map(normalizeFeedback) as FeedbackRecord[],
      // KV-backed (boundary-validated per slice; see validateKvSlice)
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
    // Only this primary, configured source with validated pagination can assert completion.
    const contentQueryComplete = Boolean(secret && dbContent && !notionSettled[3].error);
    // D-1b: decisions ride the payload, boundary-validated like the
    // other KV slices. The field is attached here rather than in
    // the SyncData literal above because the SyncData typing for it
    // lands with the Frontend leg; the wire shape is the same.
    res.json({ ...payload, decisions, syncFreshness, sourceErrors, contentQueryComplete });
  } catch (err) {
    console.error('[/api/dashboard] Error building payload:', err);
    res.status(503).json({
      error: 'Failed to build dashboard payload',
    });
  }
}
