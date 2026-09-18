/**
 * CR8W Create Well — Vercel API catch-all
 * File-based routing: api/server/[[...path]].ts handles every request to
 *   /api/server          (health check, with path = undefined)
 *   /api/server/sync     (path = ['sync'])
 *   /api/server/tasks/5  (path = ['tasks', '5'])
 *   etc.
 * Vercel automatically populates req.query.path with the matched segments.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────────
function sb() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SECRET_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Auth: accept publishable key (app-gate) or a valid Supabase user JWT ──────
async function verifyRequest(req: VercelRequest): Promise<boolean> {
  const raw = req.headers.authorization ?? '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return false;
  const pubKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
  // Fast path: exact match against the publishable key (hash-login sessions)
  if (pubKey && token === pubKey) return true;
  // JWT path: verify as a Supabase user access token
  if (pubKey) {
    try {
      const c = createClient(process.env.SUPABASE_URL!, pubKey, { auth: { persistSession: false } });
      const { data, error } = await c.auth.getUser(token);
      if (!error && data.user) return true;
    } catch { /* fall through */ }
  }
  return !pubKey; // allow when no key configured (dev/preview)
}

const TABLE = 'kv_store_8dcd9693';

// ── KV helpers ────────────────────────────────────────────────────────────────
async function kvGet(key: string): Promise<any> {
  const { data, error } = await sb().from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}
async function kvSet(key: string, value: any): Promise<void> {
  const { error } = await sb().from(TABLE).upsert({ key, value });
  if (error) throw new Error(error.message);
}
function parseList(raw: any): any[] {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []; }
  catch { return []; }
}
async function getList(key: string): Promise<any[]> { return parseList(await kvGet(key)); }
async function setList(key: string, list: any[]): Promise<void> { await kvSet(key, JSON.stringify(list)); }

// ── CORS ──────────────────────────────────────────────────────────────────────
function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ── Body parser ───────────────────────────────────────────────────────────────
function readBody(req: VercelRequest): Promise<any> {
  return new Promise(resolve => {
    if (req.body) { resolve(req.body); return; }
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Auth gate — health endpoint is public; everything else requires a valid token
  const pathCheck = !req.query.path ? [] : Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const firstSeg = pathCheck[0] ?? '';
  if (firstSeg && firstSeg !== 'health') {
    if (!await verifyRequest(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  }

  // req.query.path is the catch-all: undefined | string | string[]
  const pathArr = !req.query.path
    ? []
    : Array.isArray(req.query.path) ? req.query.path : [req.query.path];

  const [resource = '', id = '', sub = ''] = pathArr;
  const method = req.method ?? 'GET';

  try {
    // ── Health ────────────────────────────────────────────────────────────────
    if (!resource || resource === 'health') {
      res.json({ status: 'ok', runtime: 'vercel' }); return;
    }

    // ── Sync ──────────────────────────────────────────────────────────────────
    if (resource === 'sync' && method === 'GET') {
      const KEYS = [
        'cr8w_tasks','cr8w_stations','cr8w_forum','cr8w_messages',
        'cr8w_braindumps','cr8w_announcements','cr8w_forum_replies',
        'cr8w_workshops','cr8w_workshop_programs','cr8w_workshop_resources',
        'cr8w_coflow_dates','cr8w_coflow_checkins','cr8w_well_notes','cr8w_calendar_events',
      ];
      const { data, error } = await sb().from(TABLE).select('key,value').in('key', KEYS);
      if (error) { res.status(500).json({ error: error.message }); return; }
      const m: Record<string, any[]> = {};
      for (const row of data ?? []) m[row.key] = parseList(row.value);
      res.json({
        tasks: m['cr8w_tasks']??[], stations: m['cr8w_stations']??[],
        forum: m['cr8w_forum']??[], messages: m['cr8w_messages']??[],
        braindumps: m['cr8w_braindumps']??[], announcements: m['cr8w_announcements']??[],
        forumReplies: m['cr8w_forum_replies']??[], workshops: m['cr8w_workshops']??[],
        workshopPrograms: m['cr8w_workshop_programs']??[], workshopResources: m['cr8w_workshop_resources']??[],
        coflowDates: m['cr8w_coflow_dates']??[], coflowCheckins: m['cr8w_coflow_checkins']??[],
        wellNotes: m['cr8w_well_notes']??[], calendarEvents: m['cr8w_calendar_events']??[],
      });
      return;
    }

    // ── Forum replies (nested routes) ─────────────────────────────────────────
    // GET/POST  /forum/:postId/replies
    if (resource === 'forum' && sub === 'replies') {
      const all = await getList('cr8w_forum_replies');
      if (method === 'GET') { res.json(all.filter((r: any) => String(r.postId) === String(id))); return; }
      if (method === 'POST') {
        const b = await readBody(req);
        const reply = { ...b, id: Date.now(), postId: Number(id)||id, created_at: new Date().toISOString() };
        all.push(reply);
        await setList('cr8w_forum_replies', all);
        res.status(201).json(reply); return;
      }
    }
    // GET  /forum/replies/all
    if (resource === 'forum' && id === 'replies' && sub === 'all' && method === 'GET') {
      res.json(await getList('cr8w_forum_replies')); return;
    }
    // DELETE  /forum/replies/:replyId
    if (resource === 'forum' && id === 'replies' && sub && method === 'DELETE') {
      const all = await getList('cr8w_forum_replies');
      await setList('cr8w_forum_replies', all.filter((r: any) => String(r.id) !== sub));
      res.json({ ok: true }); return;
    }

    // ── Invite counts ─────────────────────────────────────────────────────────
    if (resource === 'invite-counts') {
      if (method === 'GET') {
        const raw = await kvGet('cr8w_invite_counts');
        const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
        res.json(parsed ?? { confirmed:0, pending:0, declined:0, maybe:0, total:0 }); return;
      }
      if (method === 'POST') {
        const b = await readBody(req);
        const counts = { confirmed:Number(b.confirmed)||0, pending:Number(b.pending)||0, declined:Number(b.declined)||0, maybe:Number(b.maybe)||0, total:Number(b.total)||0, updated_at: new Date().toISOString() };
        await kvSet('cr8w_invite_counts', JSON.stringify(counts));
        res.json({ ok:true, ...counts }); return;
      }
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    if (resource === 'settings' && id) {
      const sk = `cr8w_settings_${id}`;
      if (method === 'GET') {
        const raw = await kvGet(sk);
        const val = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw) : null;
        res.json({ value: val }); return;
      }
      if (method === 'PUT') {
        const b = await readBody(req);
        await kvSet(sk, JSON.stringify(b.value));
        res.json({ ok:true }); return;
      }
    }

    // ── Calendar events ───────────────────────────────────────────────────────
    if (resource === 'calendar-events') {
      if (method === 'GET') { res.json(await getList('cr8w_calendar_events')); return; }
      if (method === 'POST') {
        const b = await readBody(req);
        const evts = Array.isArray(b) ? b : (b.events ?? []);
        const norm = evts.map((ev: any, i: number) => ({
          id: ev.id || `gcal-${Date.now()}-${i}`, title: ev.title||'(No title)',
          start: ev.start||'', end: ev.end||'', location: ev.location||'',
          description: ev.description||'', creator: ev.creator||'',
          synced_at: new Date().toISOString(),
        }));
        await setList('cr8w_calendar_events', norm);
        res.json({ ok:true, count: norm.length }); return;
      }
    }

    // ── Parking lot ───────────────────────────────────────────────────────────
    if (resource === 'parking-lot') {
      if (method === 'GET') { res.json(await getList('cr8w_parking_lot')); return; }
      if (method === 'POST') {
        const b = await readBody(req);
        if (Array.isArray(b)) { await setList('cr8w_parking_lot', b); res.json({ ok:true, count: b.length }); return; }
        const lst = await getList('cr8w_parking_lot');
        const item = { id: b.id||`pl-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, text:b.text||'', category:b.category||'spark', author:b.author||'monny', created_at:b.created_at||new Date().toISOString() };
        lst.unshift(item);
        await setList('cr8w_parking_lot', lst);
        res.json({ ok:true, item }); return;
      }
      if (method === 'DELETE' && id) {
        const lst = await getList('cr8w_parking_lot');
        await setList('cr8w_parking_lot', lst.filter((x: any) => x.id !== id));
        res.json({ ok:true }); return;
      }
    }


    // ── iCal Calendar Sync ────────────────────────────────────────────────────
    // POST /calendar-ical-sync  — fetches CR8W_ICAL_URL, parses VEVENTs, stores
    if (resource === 'calendar-ical-sync' && method === 'POST') {
      const icalUrl = process.env.CR8W_ICAL_URL;
      if (!icalUrl) { res.status(500).json({ error: 'CR8W_ICAL_URL env var not set on Vercel' }); return; }
      try {
        const icalRes = await fetch(icalUrl);
        if (!icalRes.ok) { res.status(502).json({ error: `iCal fetch failed: ${icalRes.status}` }); return; }
        const text = await icalRes.text();

        // Parse VEVENT blocks
        const events: any[] = [];
        const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
        let m: RegExpExecArray | null;
        while ((m = veventRe.exec(text)) !== null) {
          const block = m[1];
          const prop = (name: string) => {
            const r = new RegExp(String.raw`${name}[^:
]*:([^
]+)`);
            const hit = block.match(r);
            return hit ? hit[1].replace(/\n/g, '
').replace(/\,/g, ',').replace(//g, '').trim() : '';
          };
          const rawStart = prop('DTSTART');
          const rawEnd   = prop('DTEND');
          const parseICalDate = (dt: string): string => {
            if (!dt) return '';
            // All-day: YYYYMMDD (8 digits, no T)
            if (/^\d{8}$/.test(dt)) return `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}T00:00:00`;
            // DateTime with Z: YYYYMMDDTHHMMSSZ
            const clean = dt.replace(/Z$/, '+00:00');
            const iso = clean.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6');
            const d = new Date(iso);
            return isNaN(d.getTime()) ? dt : d.toISOString();
          };
          events.push({
            id: prop('UID') || `ical-${Date.now()}-${events.length}`,
            title: prop('SUMMARY') || '(No title)',
            start: parseICalDate(rawStart),
            end:   parseICalDate(rawEnd),
            location:    prop('LOCATION'),
            description: prop('DESCRIPTION'),
            creator:     '',
            synced_at:   new Date().toISOString(),
          });
        }

        await setList('cr8w_calendar_events', events);
        res.json({ ok: true, count: events.length });
        return;
      } catch (e: any) {
        console.error('[ical-sync]', e);
        res.status(500).json({ error: `iCal sync failed: ${e?.message ?? e}` });
        return;
      }
    }

    // ── GCal OAuth token exchange ─────────────────────────────────────────────
    if (resource === 'gcal-token-exchange' && method === 'POST') {
      const { code, code_verifier, redirect_uri, client_id } = await readBody(req);
      if (!code || !redirect_uri || !client_id) { res.status(400).json({ error: 'Missing fields' }); return; }
      const secret = process.env.GCAL_CLIENT_SECRET;
      if (!secret) { res.status(500).json({ error: 'GCAL_CLIENT_SECRET not set' }); return; }
      const params: Record<string, string> = { code, client_id, client_secret: secret, redirect_uri, grant_type: 'authorization_code' };
      if (code_verifier) params.code_verifier = code_verifier;
      const tr = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams(params).toString() });
      const td = await tr.json();
      if (td.error) { res.status(400).json({ error: td.error, error_description: td.error_description }); return; }
      res.json({ access_token: td.access_token, refresh_token: td.refresh_token, expires_in: td.expires_in, token_type: td.token_type, scope: td.scope });
      return;
    }

    // ── Generic list CRUD ─────────────────────────────────────────────────────
    const KV: Record<string, string> = {
      tasks:'cr8w_tasks', stations:'cr8w_stations', forum:'cr8w_forum',
      messages:'cr8w_messages', braindumps:'cr8w_braindumps', announcements:'cr8w_announcements',
      workshops:'cr8w_workshops', 'workshop-programs':'cr8w_workshop_programs',
      'workshop-resources':'cr8w_workshop_resources', 'coflow-dates':'cr8w_coflow_dates',
      'coflow-checkins':'cr8w_coflow_checkins', 'well-notes':'cr8w_well_notes',
    };
    const kvKey = KV[resource];
    if (kvKey) {
      if (method === 'GET' && !id) { res.json(await getList(kvKey)); return; }
      if (method === 'POST' && !id) {
        const b = await readBody(req);
        const list = await getList(kvKey);
        const item = { ...b, id: Date.now(), created_at: new Date().toISOString() };
        if (['forum','braindumps','announcements'].includes(resource)) list.unshift(item);
        else if (resource === 'messages') { list.push(item); if (list.length > 500) list.splice(0, list.length - 500); }
        else list.push(item);
        await setList(kvKey, list);
        res.status(201).json(item); return;
      }
      if (method === 'PUT' && id) {
        const b = await readBody(req);
        const list = await getList(kvKey);
        const idx = list.findIndex((x: any) => String(x.id) === id);
        if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
        list[idx] = { ...list[idx], ...b, id: list[idx].id, updated_at: new Date().toISOString() };
        await setList(kvKey, list);
        res.json(list[idx]); return;
      }
      if (method === 'DELETE' && id) {
        const list = await getList(kvKey);
        await setList(kvKey, list.filter((x: any) => String(x.id) !== id));
        res.json({ ok:true }); return;
      }
    }

    res.status(404).json({ error: `Unknown: ${method} /api/server/${pathArr.join('/')}` });
  } catch (e: any) {
    console.error('[cr8w-api]', e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
