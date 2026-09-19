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

// ── Supabase client ───────────────────────────────────────────────────────────
function supabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

const TABLE = 'kv_store_dabe1c74';

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

// ── Shared Google Calendar iCalendar sync ───────────────────────────────────
const TEAM_CALENDAR_ID = 'mb@tablante.com';

function unescapeIcal(value: string): string {
  return value.replace(/\n/gi, '\n').replace(/\,/g, ',').replace(/\;/g, ';').replace(/\\/g, '\\');
}

function parseIcalDate(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return value;
  const [, year, month, day, hour, minute, second, utc] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${utc}`;
}

function parseIcalEvents(ical: string): Array<Record<string, string>> {
  const lines = ical.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded = lines.reduce<string[]>((result, line) => {
    if (/^[ \t]/.test(line) && result.length) result[result.length - 1] += line.slice(1);
    else result.push(line);
    return result;
  }, []);

  const events: Array<Record<string, string>> = [];
  let event: Record<string, string> | null = null;
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') { event = {}; continue; }
    if (line === 'END:VEVENT') { if (event) events.push(event); event = null; continue; }
    if (!event) continue;
    const delimiter = line.indexOf(':');
    if (delimiter < 0) continue;
    const key = line.slice(0, delimiter).split(';', 1)[0].toUpperCase();
    event[key] = unescapeIcal(line.slice(delimiter + 1));
  }
  return events;
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
        'cr8w_calendar_events',
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
        const normalized = events.map((ev: any, i: number) => ({
          id: ev.id || `gcal-${Date.now()}-${i}`,
          title: ev.title || '(No title)',
          start: ev.start || '',
          end: ev.end || '',
          location: ev.location || '',
          description: ev.description || '',
          creator: ev.creator || '',
          synced_at: new Date().toISOString(),
        }));
        await setList('cr8w_calendar_events', normalized);
        res.json({ ok: true, count: normalized.length }); return;
      }
    }

    if (resource === 'calendar-ical-sync' && method === 'POST') {
      const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(TEAM_CALENDAR_ID)}/public/basic.ics`;
      const icalRes = await fetch(icalUrl);
      if (!icalRes.ok) {
        res.status(502).json({ error: `Unable to fetch shared calendar (${icalRes.status})` }); return;
      }
      const events = parseIcalEvents(await icalRes.text())
        .filter(event => event.UID && event.DTSTART)
        .map(event => ({
          id: `ical-${event.UID}`,
          title: event.SUMMARY || '(No title)',
          start: parseIcalDate(event.DTSTART),
          end: parseIcalDate(event.DTEND),
          location: event.LOCATION || '',
          description: event.DESCRIPTION || '',
          creator: 'shared-calendar',
          synced_at: new Date().toISOString(),
        }));
      await setList('cr8w_calendar_events', events);
      res.json({ ok: true, count: events.length }); return;
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
    async function syncToNotion(action: 'create' | 'update' | 'archive', item?: any): Promise<string | undefined> {
      const cfg = NOTION_RESOURCES[resource];
      if (!cfg) return undefined;
      const dbId = process.env[cfg.dbIdEnvVar];
      if (!dbId || !process.env.NOTION_SECRET) return undefined;
      try {
        if (action === 'create' && item) {
          return await notionCreate(dbId, cfg.toProperties(item));
        }
        if (action === 'update' && item?.notionPageId) {
          await notionUpdate(item.notionPageId, cfg.toProperties(item));
        }
        if (action === 'archive' && item?.notionPageId) {
          await notionArchive(item.notionPageId);
        }
      } catch (err) {
        console.error(`[notionWriter] ${action} failed for ${resource}:`, err);
      }
      return undefined;
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
        const notionPageId = await syncToNotion('create', item);
        if (notionPageId) item.notionPageId = notionPageId;
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
        list[idx] = { ...list[idx], ...b, id: list[idx].id, updated_at: new Date().toISOString() };
        // Notion dual-write: update if item has a notionPageId
        await syncToNotion('update', list[idx]);
        await setList(kvKey, list);
        res.json(list[idx]); return;
      }
      if (method === 'DELETE' && id) {
        const list = await getList(kvKey);
        const target = list.find((x: any) => String(x.id) === String(id));
        // Notion dual-write: archive if item has a notionPageId
        if (target) await syncToNotion('archive', target);
        await setList(kvKey, list.filter((x: any) => String(x.id) !== String(id)));
        res.json({ ok: true }); return;
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

    // ── 404 fallback ──────────────────────────────────────────────────────────
    res.status(404).json({ error: `Unknown route: ${method} /${rawPath}` });
  } catch (e: any) {
    console.error('API error:', e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
