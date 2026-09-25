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
import { NOTION_RESOURCES, notionCreate, notionUpdate, notionArchive } from './notionWriter.js';
import { canonicalCheckinHash, canonicalNoteHash, syncHistoryToWorkspace } from './workspaceSync.js';

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

// ── Route dispatcher ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Resolve path: supports both /api/server/sync and /api/server?path=sync
  const urlPath = (req.url || '').replace(/^\/api\/server\/?/, '').replace(/\?.*$/, '');
  const queryPath = Array.isArray(req.query.path)
    ? req.query.path.join('/')
    : (req.query.path as string) ?? '';
  const rawPath = queryPath || urlPath;

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
      const [{ data: canonicalNotes }, { data: canonicalCheckins }] = await Promise.all([
        sb.from('well_notes').select('id,content,landed,created_at,updated_at').order('created_at', { ascending: false }).limit(5000),
        sb.from('care_loop_checkins').select('id,week_of,author,confirm_time,location_suggestion,agenda_items,mood,time_preference,notes,created_at,updated_at').order('created_at', { ascending: false }).limit(5000),
      ]);
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
        coflowCheckins: (canonicalCheckins ?? []).map((checkin: any) => ({ ...checkin, weekOf: checkin.week_of, confirmTime: checkin.confirm_time, locationSuggestion: checkin.location_suggestion, agendaItems: checkin.agenda_items, timePreference: checkin.time_preference })),
        wellNotes: canonicalNotes ?? [],
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

    // ── Canonical history (the KV rows remain only as a legacy cache) ──────────
    if (resource === 'well-notes') {
      const sb = supabase();
      if (method === 'GET' && !id) {
        const { data, error } = await sb.from('well_notes').select('id,content,landed,created_at,updated_at').order('created_at', { ascending: false }).limit(5000);
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.json(data ?? []); return;
      }
      if (method === 'POST' && !id) {
        const b = await body(req);
        const item = { id: Date.now(), content: String(b.content || '').trim(), landed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source: 'dashboard' };
        if (!item.content) { res.status(400).json({ error: 'content required' }); return; }
        const { data, error } = await sb.from('well_notes').insert({ ...item, source_hash: canonicalNoteHash(item) }).select('id,content,landed,created_at,updated_at').single();
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.status(201).json(data); return;
      }
      if (method === 'PUT' && id) {
        const { data: existing, error: readError } = await sb.from('well_notes').select('id,content,landed,created_at').eq('id', Number(id)).maybeSingle();
        if (readError) { res.status(500).json({ error: readError.message }); return; }
        if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
        const b = await body(req);
        const next = { ...existing, content: b.content === undefined ? existing.content : String(b.content), landed: b.landed === undefined ? existing.landed : Number(b.landed) };
        const { data, error } = await sb.from('well_notes').update({ content: next.content, landed: next.landed, source_hash: canonicalNoteHash(next) }).eq('id', Number(id)).select('id,content,landed,created_at,updated_at').single();
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.json(data); return;
      }
    }

    if (resource === 'coflow-checkins') {
      const sb = supabase();
      if (method === 'GET' && !id) {
        const { data, error } = await sb.from('care_loop_checkins').select('id,week_of,author,confirm_time,location_suggestion,agenda_items,mood,time_preference,notes,created_at,updated_at').order('created_at', { ascending: false }).limit(5000);
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.json((data ?? []).map((checkin: any) => ({ ...checkin, weekOf: checkin.week_of, confirmTime: checkin.confirm_time, locationSuggestion: checkin.location_suggestion, agendaItems: checkin.agenda_items, timePreference: checkin.time_preference }))); return;
      }
      if (method === 'POST' && !id) {
        const b = await body(req);
        const item = { id: Date.now(), week_of: b.weekOf || null, author: String(b.author || 'unknown'), confirm_time: Boolean(b.confirmTime), location_suggestion: String(b.locationSuggestion || ''), agenda_items: Array.isArray(b.agendaItems) ? b.agendaItems : [], mood: b.mood || null, time_preference: b.timePreference || null, notes: b.notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source: 'dashboard' };
        const { data, error } = await sb.from('care_loop_checkins').insert({ ...item, source_hash: canonicalCheckinHash({ ...item, week_of: item.week_of }) }).select('id,week_of,author,confirm_time,location_suggestion,agenda_items,mood,time_preference,notes,created_at,updated_at').single();
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.status(201).json({ ...data, weekOf: data.week_of, confirmTime: data.confirm_time, locationSuggestion: data.location_suggestion, agendaItems: data.agenda_items, timePreference: data.time_preference }); return;
      }
      if (method === 'DELETE' && id) {
        const { error } = await sb.from('care_loop_checkins').delete().eq('id', Number(id));
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.json({ ok: true }); return;
      }
    }

    // ── Workspace sync + historical reports ───────────────────────────────────
    if (resource === 'workspace-sync' && (method === 'GET' || method === 'POST')) {
      const secret = process.env.CRON_SECRET;
      if (secret && req.headers.authorization !== `Bearer ${secret}`) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const result = await syncHistoryToWorkspace();
      res.status(result.status === 'failed' ? 500 : result.status === 'conflict' ? 409 : 200).json(result); return;
    }

    if (resource === 'reports' && (id === 'history' || id === 'history.csv')) {
      const sb = supabase();
      const from = typeof req.query.from === 'string' ? req.query.from : null;
      const to = typeof req.query.to === 'string' ? req.query.to : null;
      let noteQuery = sb.from('well_notes').select('id,content,landed,created_at,updated_at').order('created_at', { ascending: false }).limit(5000);
      let checkinQuery = sb.from('care_loop_checkins').select('id,week_of,author,confirm_time,location_suggestion,agenda_items,mood,time_preference,notes,created_at,updated_at').order('created_at', { ascending: false }).limit(5000);
      if (from) { noteQuery = noteQuery.gte('created_at', from); checkinQuery = checkinQuery.gte('created_at', from); }
      if (to) { noteQuery = noteQuery.lte('created_at', to); checkinQuery = checkinQuery.lte('created_at', to); }
      const [{ data: notes, error: noteError }, { data: checkins, error: checkinError }] = await Promise.all([noteQuery, checkinQuery]);
      if (noteError || checkinError) { res.status(500).json({ error: noteError?.message || checkinError?.message }); return; }
      const rows = { generated_at: new Date().toISOString(), from, to, notes: notes ?? [], checkins: checkins ?? [], summary: { note_count: notes?.length ?? 0, checkin_count: checkins?.length ?? 0, landed_count: (notes ?? []).reduce((sum: number, note: any) => sum + Number(note.landed || 0), 0) } };
      if (id === 'history.csv') {
        const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const lines = ['type,id,created_at,author_or_status,content_or_notes,landed_or_confirmed,mood'];
        for (const note of rows.notes as any[]) lines.push(['well_note', note.id, note.created_at, '', note.content, note.landed, ''].map(csvCell).join(','));
        for (const checkin of rows.checkins as any[]) lines.push(['care_loop_checkin', checkin.id, checkin.created_at, checkin.author, checkin.notes || '', checkin.confirm_time, checkin.mood || ''].map(csvCell).join(','));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="created-well-history.csv"');
        res.send(lines.join('\n')); return;
      }
      res.json(rows); return;
    }

    if (resource === 'reports' && id === 'conflicts' && method === 'GET') {
      const { data, error } = await supabase().from('workspace_sync_conflicts').select('id,entity_type,entity_id,spreadsheet_id,sheet_name,row_number,local_hash,remote_hash,remote_values,status,resolution,created_at,resolved_at').eq('status', 'open').order('created_at', { ascending: false }).limit(500);
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.json(data ?? []); return;
    }

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

    // ── Calendar iCal sync ───────────────────────────────────────────────────
    if (resource === 'calendar-ical-sync' && (method === 'POST' || method === 'GET')) {
      const b = await body(req).catch(() => ({}));
      const icalUrl = b.url || process.env.CR8W_ICAL_URL || process.env.GCAL_CREATEWELL_ICS_URL;
      if (!icalUrl) {
        res.status(400).json({ error: 'Missing iCal URL. Pass url in body or set CR8W_ICAL_URL / GCAL_CREATEWELL_ICS_URL.' });
        return;
      }
      try {
        const icalRes = await fetch(icalUrl);
        if (!icalRes.ok) {
          res.status(502).json({ error: `Failed to fetch iCal feed: ${icalRes.status} ${icalRes.statusText}` });
          return;
        }
        const text = await icalRes.text();
        const events: any[] = [];
        const lines = text.split(/\r?\n/);
        let inEvent = false;
        let cur: any = {};
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
            line += lines[++i].slice(1);
          }
          if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue; }
          if (line === 'END:VEVENT') {
            if (cur.summary && cur.dtstart) {
              events.push({
                id: cur.uid || `ical-${Date.now()}-${events.length}`,
                title: cur.summary,
                start: cur.dtstart,
                end: cur.dtend || cur.dtstart,
                location: cur.location || '',
                description: cur.description || '',
                synced_at: new Date().toISOString(),
              });
            }
            inEvent = false; cur = {}; continue;
          }
          if (!inEvent) continue;
          const [rawKey, ...rest] = line.split(':');
          const val = rest.join(':').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
          const key = rawKey.split(';')[0].toUpperCase();
          if (key === 'SUMMARY') cur.summary = val;
          else if (key === 'DTSTART') cur.dtstart = val;
          else if (key === 'DTEND') cur.dtend = val;
          else if (key === 'LOCATION') cur.location = val;
          else if (key === 'DESCRIPTION') cur.description = val;
          else if (key === 'UID') cur.uid = val;
        }
        await setList('cr8w_calendar_events', events);
        res.json({ ok: true, count: events.length, synced_at: new Date().toISOString() });
        return;
      } catch (err: any) {
        res.status(500).json({ error: `iCal sync failed: ${err.message}` });
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
