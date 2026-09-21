/**
 * CR8W Create Well — Vercel API handler
 * Single catch-all route that replaces the Supabase edge function.
 *
 * Write strategy:
 *   • All 14 resource types are persisted in Supabase KV (primary, fast, always-on).
 *   • The 4 Notion-backed types (tasks, stations, forum, coflow-dates) are also
 *     written to Notion when NOTION_SECRET and the matching NOTION_DB_* env vars
 *     are present.  Notion writes are best-effort: a Notion failure logs the error
 *     but does not block the KV write or the HTTP response.
 *   • notionPageId is stored on every KV item that was successfully written to
 *     Notion so subsequent PUT/DELETE can target the correct Notion page.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { NOTION_RESOURCES, notionCreate, notionUpdate, notionArchive } from './_notionWriter.js';
import { getNotionConfig } from './_notionConfig.js';
import { KV_TABLE, KV_KEYS } from '../src/config/sync.js';

// ── Supabase client ───────────────────────────────────────────────────────────
function supabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

const TABLE = KV_TABLE;

// ── KV helpers ────────────────────────────────────────────────────────────────
async function kvGet(key: string): Promise<any> {
  const { data, error } = await supabase().from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

async function kvSet(key: string, value: any): Promise<void> {
  const { error } = await supabase().from(TABLE).upsert({ key, value });
  if (error) throw new Error(error.message);
}

function parseList(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []; }
  catch { return []; }
}

async function getList(key: string): Promise<any[]> {
  return parseList(await kvGet(key));
}

async function setList(key: string, list: any[]): Promise<void> {
  await kvSet(key, JSON.stringify(list));
}

// ── iCal parser (RFC 5545 zero-dependency helper) ────────────────────────────
function parseIcal(raw: string): any[] {
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: any[] = [];
  let inEvent = false;
  let cur: Record<string, string> = {};

  function parseIcalDate(val: string): string {
    if (!val) return '';
    const clean = val.trim();
    if (/^\d{8}T\d{6}Z?$/.test(clean)) {
      const y = clean.slice(0, 4);
      const m = clean.slice(4, 6);
      const d = clean.slice(6, 8);
      const h = clean.slice(9, 11);
      const min = clean.slice(11, 13);
      const s = clean.slice(13, 15);
      const isUtc = clean.endsWith('Z');
      return `${y}-${m}-${d}T${h}:${min}:${s}${isUtc ? 'Z' : ''}`;
    }
    if (/^\d{8}$/.test(clean)) {
      const y = clean.slice(0, 4);
      const m = clean.slice(4, 6);
      const d = clean.slice(6, 8);
      return `${y}-${m}-${d}`;
    }
    return clean;
  }

  function unescapeIcalText(s: string): string {
    return s
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      cur = {};
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (inEvent && (cur.SUMMARY || cur.DTSTART)) {
        events.push({
          id: cur.UID || `ical-${Date.now()}-${events.length}`,
          title: cur.SUMMARY ? unescapeIcalText(cur.SUMMARY) : '(No title)',
          start: parseIcalDate(cur.DTSTART || ''),
          end: parseIcalDate(cur.DTEND || ''),
          location: cur.LOCATION ? unescapeIcalText(cur.LOCATION) : '',
          description: cur.DESCRIPTION ? unescapeIcalText(cur.DESCRIPTION) : '',
          creator: 'team',
          synced_at: new Date().toISOString(),
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const keyPart = line.slice(0, colonIdx);
    const val = line.slice(colonIdx + 1);
    const key = keyPart.split(';')[0].trim().toUpperCase();
    if (key === 'SUMMARY') cur.SUMMARY = val;
    else if (key === 'DTSTART') cur.DTSTART = val;
    else if (key === 'DTEND') cur.DTEND = val;
    else if (key === 'LOCATION') cur.LOCATION = val;
    else if (key === 'DESCRIPTION') cur.DESCRIPTION = val;
    else if (key === 'UID') cur.UID = val;
  }
  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return events;
}

// ── CORS headers ──────────────────────────────────────────────────────────────
function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ── Body parser ───────────────────────────────────────────────────────────────
function body(req: VercelRequest): Promise<any> {
  return new Promise((resolve) => {
    if (req.body) { resolve(req.body); return; }
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

function resolveRawPath(req: VercelRequest): string {
  if (Array.isArray(req.query.path)) return req.query.path.join('/');
  if (typeof req.query.path === 'string' && req.query.path.length > 0) return req.query.path;

  const pathname = new URL(req.url ?? '/api/server', 'http://localhost').pathname;
  return pathname
    .replace(/^\/api\/server(?:\/|$)/, '')
    .replace(/^\/+/, '');
}

// ── Route dispatcher ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Resolve path: /api/server/sync → "sync"; /api/server/tasks/123 → "tasks/123"
  const rawPath = resolveRawPath(req);

  const segments = rawPath.split('/').filter(Boolean);
  const [resource, id, sub, subId] = segments;
  const method = req.method ?? 'GET';

  try {
    // ── Health ────────────────────────────────────────────────────────────────
    if (resource === 'health') {
      res.json({ status: 'ok', runtime: 'vercel' }); return;
    }

    // ── Sync ──────────────────────────────────────────────────────────────────
    if (resource === 'sync' && method === 'GET') {
      const SYNC_KEYS = [
        'cr8w_tasks', 'cr8w_stations', 'cr8w_forum', 'cr8w_messages',
        'cr8w_braindumps', 'cr8w_announcements', 'cr8w_forum_replies',
        'cr8w_workshops', 'cr8w_workshop_programs', 'cr8w_workshop_resources',
        'cr8w_coflow_dates', 'cr8w_coflow_checkins', 'cr8w_well_notes',
        'cr8w_calendar_events', 'cr8w_money', 'cr8w_parking_lot',
      ];
      const sb = supabase();
      const { data, error } = await sb.from(TABLE).select('key,value').in('key', SYNC_KEYS);
      if (error) { res.status(500).json({ error: error.message }); return; }
      const map: Record<string, any[]> = {};
      for (const row of data ?? []) map[row.key] = parseList(row.value);
      res.json({
        tasks: map['cr8w_tasks'] ?? [],
        stations: map['cr8w_stations'] ?? [],
        forum: map['cr8w_forum'] ?? [],
        messages: map['cr8w_messages'] ?? [],
        braindumps: map['cr8w_braindumps'] ?? [],
        announcements: map['cr8w_announcements'] ?? [],
        forumReplies: map['cr8w_forum_replies'] ?? [],
        workshops: map['cr8w_workshops'] ?? [],
        workshopPrograms: map['cr8w_workshop_programs'] ?? [],
        workshopResources: map['cr8w_workshop_resources'] ?? [],
        coflowDates: map['cr8w_coflow_dates'] ?? [],
        coflowCheckins: map['cr8w_coflow_checkins'] ?? [],
        wellNotes: map['cr8w_well_notes'] ?? [],
        calendarEvents: map['cr8w_calendar_events'] ?? [],
        money: map['cr8w_money'] ?? [],
        parkingLot: map['cr8w_parking_lot'] ?? [],
      });
      return;
    }

    // ── Generic CRUD for list resources ───────────────────────────────────────
    const KV_MAP: Record<string, string> = {
      tasks: 'cr8w_tasks',
      stations: 'cr8w_stations',
      forum: 'cr8w_forum',
      messages: 'cr8w_messages',
      braindumps: 'cr8w_braindumps',
      announcements: 'cr8w_announcements',
      workshops: 'cr8w_workshops',
      'workshop-programs': 'cr8w_workshop_programs',
      'workshop-resources': 'cr8w_workshop_resources',
      'coflow-dates': 'cr8w_coflow_dates',
      'coflow-checkins': 'cr8w_coflow_checkins',
      'well-notes': 'cr8w_well_notes',
      money: 'cr8w_money',
    };

    // ── Forum replies (nested: /forum/:id/replies[/:replyId]) ─────────────────
    if (resource === 'forum' && sub === 'replies') {
      const postId = id;
      if (method === 'GET') {
        const all = await getList('cr8w_forum_replies');
        res.json(all.filter((r: any) => String(r.postId) === String(postId)));
        return;
      }
      if (method === 'POST') {
        const b = await body(req);
        const all = await getList('cr8w_forum_replies');
        const newReply = { ...b, id: Date.now(), postId: Number(postId) || postId, created_at: new Date().toISOString() };
        all.push(newReply);
        await setList('cr8w_forum_replies', all);
        res.status(201).json(newReply);
        return;
      }
    }

    // GET all forum replies
    if (resource === 'forum' && id === 'replies' && sub === 'all' && method === 'GET') {
      res.json(await getList('cr8w_forum_replies')); return;
    }

    // DELETE a forum reply by replyId: /forum/replies/:replyId
    if (resource === 'forum' && id === 'replies' && sub && method === 'DELETE') {
      const all = await getList('cr8w_forum_replies');
      await setList('cr8w_forum_replies', all.filter((r: any) => String(r.id) !== String(sub)));
      res.json({ ok: true }); return;
    }

    // ── Invite counts ─────────────────────────────────────────────────────────
    if (resource === 'invite-counts') {
      if (method === 'GET') {
        const raw = await kvGet('cr8w_invite_counts');
        res.json(raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { confirmed: 0, pending: 0, declined: 0, maybe: 0, total: 0 });
        return;
      }
      if (method === 'POST') {
        const b = await body(req);
        const counts = { confirmed: Number(b.confirmed)||0, pending: Number(b.pending)||0, declined: Number(b.declined)||0, maybe: Number(b.maybe)||0, total: Number(b.total)||0, updated_at: new Date().toISOString() };
        await kvSet('cr8w_invite_counts', JSON.stringify(counts));
        res.json({ ok: true, ...counts }); return;
      }
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    if (resource === 'settings' && id) {
      const sk = `cr8w_settings_${id}`;
      if (method === 'GET') {
        const raw = await kvGet(sk);
        res.json({ value: raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw) : null });
        return;
      }
      if (method === 'PUT') {
        const b = await body(req);
        await kvSet(sk, JSON.stringify(b.value));
        res.json({ ok: true }); return;
      }
    }

    // ── Calendar events ───────────────────────────────────────────────────────
    if (resource === 'calendar-events') {
      if (method === 'GET') { res.json(await getList('cr8w_calendar_events')); return; }
      if (method === 'POST') {
        const b = await body(req);
        const events = Array.isArray(b) ? b : (b.events ?? []);
        const normalized = events.map((ev: any, i: number) => ({\n          id: ev.id || `gcal-${Date.now()}-${i}`,\n          title: ev.title || '(No title)',\n          start: ev.start || '',\n          end: ev.end || '',\n          location: ev.location || '',\n          description: ev.description || '',\n          creator: ev.creator || '',\n          synced_at: new Date().toISOString(),\n        }));
        await setList('cr8w_calendar_events', normalized);
        res.json({ ok: true, count: normalized.length }); return;
      }
    }

    // ── Calendar iCal Sync (Zero-OAuth shared team feed) ─────────────────────
    if (resource === 'calendar-ical-sync' && (method === 'POST' || method === 'GET')) {
      const b = await body(req).catch(() => ({}));
      const icalUrl = b.url || process.env.CR8W_ICAL_URL || process.env.GCAL_CREATEWELL_ICS_URL;
      if (!icalUrl) { res.status(400).json({ error: 'iCal feed not configured (set GCAL_CREATEWELL_ICS_URL).' }); return; }

      try {
        const icalRes = await fetch(icalUrl);
        if (!icalRes.ok) {
          res.status(icalRes.status).json({ error: `Failed to fetch iCal feed (${icalRes.status}): ${icalRes.statusText}` });
          return;
        }
        const icalText = await icalRes.text();
        const parsedEvents = parseIcal(icalText);
        await setList('cr8w_calendar_events', parsedEvents);
        res.json({ ok: true, count: parsedEvents.length, events: parsedEvents });
        return;
      } catch (err: any) {
        console.error('[calendar-ical-sync] Error:', err);
        res.status(500).json({ error: err?.message ?? String(err) });
        return;
      }
    }

    // ── Parking lot ───────────────────────────────────────────────────────────
    if (resource === 'parking-lot') {
      if (method === 'GET') { res.json(await getList('cr8w_parking_lot')); return; }
      if (method === 'POST') {
        const b = await body(req);
        if (Array.isArray(b)) { await setList('cr8w_parking_lot', b); res.json({ ok: true, count: b.length }); return; }
        const existing = await getList('cr8w_parking_lot');
        const item = { id: b.id || `pl-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, text: b.text||'', category: b.category||'spark', author: b.author||'monny', created_at: b.created_at||new Date().toISOString() };
        existing.unshift(item);
        await setList('cr8w_parking_lot', existing);
        res.json({ ok: true, item }); return;
      }
      if (method === 'DELETE' && id) {
        const existing = await getList('cr8w_parking_lot');
        await setList('cr8w_parking_lot', existing.filter((i: any) => i.id !== id));
        res.json({ ok: true }); return;
      }
    }

    // ── Google Calendar OAuth token exchange ──────────────────────────────────
    if (resource === 'gcal-token-exchange' && method === 'POST') {
      const { code, code_verifier, redirect_uri, client_id } = await body(req);
      if (!code || !redirect_uri || !client_id) { res.status(400).json({ error: 'Missing required fields' }); return; }
      const clientSecret = process.env.GCAL_CLIENT_SECRET;
      if (!clientSecret) { res.status(500).json({ error: 'GCAL_CLIENT_SECRET not configured' }); return; }
      const params: Record<string, string> = { code, client_id, client_secret: clientSecret, redirect_uri, grant_type: 'authorization_code' };
      if (code_verifier) params.code_verifier = code_verifier;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) { res.status(400).json({ error: tokenData.error, error_description: tokenData.error_description }); return; }
      res.json({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_in: tokenData.expires_in, token_type: tokenData.token_type, scope: tokenData.scope });
      return;
    }

    // ── Notion dual-write helper ───────────────────────────────────────────────
    // Fires-and-forgets a Notion sync; never throws so KV writes always succeed.
    async function syncToNotion(action: 'create' | 'update' | 'archive', item?: any): Promise<{
      state: 'written' | 'partial' | 'failed' | 'skipped';
      db?: string;
      pageId?: string;
      dropped?: { property: string; reason: string }[];
      message?: string;
    }> {
      const cfg = NOTION_RESOURCES[resource];
      if (!cfg) return { state: 'skipped', message: 'Resource not Notion-backed' };

      const dbMap: Record<string, string> = {
        tasks: 'MOVES',
        stations: 'PEOPLE',
        forum: 'CONTENT',
        'coflow-dates': 'FLOWS',
        money: 'MONEY',
      };
      const db = dbMap[resource];

      // Enforce write policy: MONEY is read-only in Phase 1
      if (db === 'MONEY') {
        return { state: 'skipped', db, message: 'MONEY is read-only (Phase 2)' };
      }

      const { databaseIds, secret } = getNotionConfig();
      const dbId = process.env[cfg.dbIdEnvVar] || databaseIds[resource as keyof typeof databaseIds];
      if (!dbId || !secret) {
        return { state: 'skipped', message: 'Notion integration token or database ID missing (local only)' };
      }

      try {
        if (action === 'create' && item) {
          const pageId = await notionCreate(dbId, cfg.toProperties(item));
          return { state: 'written', db, pageId };
        }
        if (action === 'update' && item?.notionPageId) {
          await notionUpdate(item.notionPageId, cfg.toProperties(item));
          return { state: 'written', db, pageId: item.notionPageId };
        }
        if (action === 'archive' && item?.notionPageId) {
          await notionArchive(item.notionPageId);
          return { state: 'written', db, pageId: item.notionPageId };
        }
        return { state: 'skipped', db, message: 'Item has no notionPageId' };
      } catch (err: any) {
        console.error(`[notionWriter] ${action} failed for ${resource}:`, err);
        return {
          state: 'failed',
          db,
          pageId: item?.notionPageId,
          message: err?.message ? String(err.message).slice(0, 200) : 'Notion rejected write',
        };
      }
    }

    // ── Generic list CRUD (GET all / POST new / PUT :id / DELETE :id) ─────────
    const kvKey = KV_MAP[resource];
    if (kvKey) {
      if (method === 'GET' && !id) {
        res.json(await getList(kvKey)); return;
      }
      if (method === 'POST' && !id) {
        const b = await body(req);
        const list = await getList(kvKey);
        const item: Record<string, any> = { ...b, id: Date.now(), created_at: new Date().toISOString() };
        // Notion dual-write for the 4 CMS-backed types
        const syncResult = await syncToNotion('create', item);
        if (syncResult.pageId) item.notionPageId = syncResult.pageId;
        item.notionSync = syncResult;
        // Forum and messages prepend; others append
        if (resource === 'forum' || resource === 'braindumps' || resource === 'announcements') list.unshift(item);
        else if (resource === 'messages') { list.push(item); if (list.length > 500) list.splice(0, list.length - 500); }
        else list.push(item);
        await setList(kvKey, list);
        res.status(201).json(item); return;
      }
      if (method === 'PUT' && id) {
        const b = await body(req);
        const list = await getList(kvKey);
        const idx = list.findIndex((x: any) => String(x.id) === String(id));
        if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
        const updatedItem = { ...list[idx], ...b };
        const syncResult = await syncToNotion('update', updatedItem);
        list[idx] = { ...updatedItem, id: list[idx].id, updated_at: new Date().toISOString(), notionSync: syncResult };
        await setList(kvKey, list);
        res.json(list[idx]); return;
      }
      if (method === 'DELETE' && id) {
        const list = await getList(kvKey);
        const target = list.find((x: any) => String(x.id) === String(id));
        // Notion dual-write: archive if item has a notionPageId
        let syncResult = undefined;
        if (target) syncResult = await syncToNotion('archive', target);
        await setList(kvKey, list.filter((x: any) => String(x.id) !== String(id)));
        res.json({ ok: true, notionSync: syncResult }); return;
      }
    }

    // ── Username ↔ email resolution (supports username sign-in) ──────────────
    if (resource === 'username-lookup' && method === 'POST') {
      const { username } = await body(req);
      if (!username) { res.status(400).json({ error: 'username required' }); return; }
      const raw = await kvGet('cr8w_username_map');
      const map: Record<string, string> = raw
        ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
        : {};
      const email = map[String(username).toLowerCase()];
      if (!email) { res.status(404).json({ error: 'Username not found' }); return; }
      res.json({ email });
      return;
    }

    if (resource === 'register-username' && method === 'POST') {
      const { username, email } = await body(req);
      if (!username || !email) { res.status(400).json({ error: 'username and email required' }); return; }
      const key = String(username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (key.length < 2 || key.length > 30) {
        res.status(400).json({ error: 'Username must be 2–30 alphanumeric/underscore/dash characters' }); return;
      }
      const raw = await kvGet('cr8w_username_map');
      const map: Record<string, string> = raw
        ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
        : {};
      const existing = map[key];
      if (existing && existing !== email.trim().toLowerCase()) {
        res.status(409).json({ error: 'Username already taken' }); return;
      }
      map[key] = email.trim().toLowerCase();
      await kvSet('cr8w_username_map', JSON.stringify(map));
      res.json({ ok: true });
      return;
    }

    // ── Canva OAuth ── DEV ONLY ──────────────────────────────────────────────
    // main branch (dash.cr8w.com) keeps these dark until stable.
    // Set CANVA_ENABLED=true in Vercel Preview env ONLY — never in production.
    if (resource === 'canva') {
      if (process.env.CANVA_ENABLED !== 'true') {
        res.status(503).json({ error: 'Canva integration not enabled on this environment.' });
        return;
      }

      const CLIENT_ID     = process.env.CANVA_CLIENT_ID!;
      const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET!;
      const REDIRECT_URI  = process.env.CANVA_REDIRECT_URI
        ?? 'https://dash.cr8w.com/api/server/canva/callback';
      const sb = supabase();

      // GET /canva/auth — initiate PKCE flow, write state to canva_oauth_states
      if (id === 'auth' && method === 'GET') {
        const state          = crypto.randomUUID();
        const code_verifier  = crypto.randomUUID().replace(/-/g,'')
                             + crypto.randomUUID().replace(/-/g,'');
        const redirect_after = (req.query.redirect_after as string) ?? '/';
        const expires_at     = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await sb.from('canva_oauth_states')
          .insert({ state, code_verifier, redirect_after, expires_at });

        const enc       = new TextEncoder();
        const hash      = await crypto.subtle.digest('SHA-256', enc.encode(code_verifier));
        const b64       = btoa(String.fromCharCode(...new Uint8Array(hash)));
        const challenge = b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

        const params = new URLSearchParams({
          response_type: 'code',
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          state,
          scope: 'design:content:read design:meta:read asset:read profile:read',
          code_challenge: challenge,
          code_challenge_method: 'S256',
        });
        res.redirect(302, `https://www.canva.com/api/oauth/authorize?${params}`);
        return;
      }

      // GET /canva/callback — exchange code for tokens, write to canva_connections with user_id
      if (id === 'callback' && method === 'GET') {
        const { code, state, error: oErr } = req.query as Record<string, string>;
        if (oErr)            { res.redirect(302, `/?error=canva_${oErr}`); return; }
        if (!code || !state) { res.status(400).json({ error: 'Missing code or state.' }); return; }

        const { data: row } = await sb.from('canva_oauth_states')
          .select('*').eq('state', state).maybeSingle();
        if (!row) { res.status(400).json({ error: 'Invalid or expired state.' }); return; }
        await sb.from('canva_oauth_states').delete().eq('state', state);
        if (new Date(row.expires_at) < new Date()) {
          res.status(400).json({ error: 'State expired.' }); return;
        }

        const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code_verifier: row.code_verifier,
          }).toString(),
        });
        const token = await tokenRes.json();
        if (!token.access_token) {
          res.status(400).json({ error: token.error ?? 'Token exchange failed.' }); return;
        }

        const profile = await (await fetch('https://api.canva.com/rest/v1/users/me', {
          headers: { Authorization: `Bearer ${token.access_token}` },
        })).json();
        const canva_user_id = profile?.user?.id ?? null;

        const jwt = (req.headers.authorization ?? '').replace('Bearer ', '') || null;
        let user_id: string | null = null;
        if (jwt) {
          const { data: { user } } = await sb.auth.getUser(jwt);
          if (user) user_id = user.id;
        }

        const expires_at = new Date(
          Date.now() + (token.expires_in ?? 3600) * 1000
        ).toISOString();

        await sb.from('canva_connections').upsert({
          ...(user_id ? { user_id } : {}),
          canva_user_id,
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? '',
          scope: token.scope ?? '',
          token_type: token.token_type ?? 'Bearer',
          expires_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: user_id ? 'user_id' : 'canva_user_id' });

        res.redirect(302, row.redirect_after ?? '/');
        return;
      }

      // GET /canva/status — check connection for current user
      if (id === 'status' && method === 'GET') {
        const jwt = (req.headers.authorization ?? '').replace('Bearer ', '') || null;
        if (!jwt) { res.json({ connected: false }); return; }
        const { data: { user } } = await sb.auth.getUser(jwt);
        if (!user) { res.json({ connected: false }); return; }
        const { data: conn } = await sb.from('canva_connections')
          .select('canva_user_id, expires_at, scope')
          .eq('user_id', user.id).maybeSingle();
        if (!conn) { res.json({ connected: false }); return; }
        res.json({ connected: new Date(conn.expires_at) > new Date(), ...conn });
        return;
      }

      // POST /canva/disconnect
      if (id === 'disconnect' && method === 'POST') {
        const jwt = (req.headers.authorization ?? '').replace('Bearer ', '') || null;
        if (!jwt) { res.status(401).json({ error: 'Unauthorized.' }); return; }
        const { data: { user } } = await sb.auth.getUser(jwt);
        if (!user) { res.status(401).json({ error: 'Invalid session.' }); return; }
        await sb.from('canva_connections').delete().eq('user_id', user.id);
        res.json({ ok: true }); return;
      }

      res.status(404).json({ error: `Unknown Canva route: ${id}` });
      return;
    }

    // ── 404 fallback ──────────────────────────────────────────────────────────
    res.status(404).json({ error: `Unknown route: ${method} /${rawPath}` });
  } catch (e: any) {
    console.error('API error:', e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
