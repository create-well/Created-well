import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TABLE = 'kv_store_dabe1c74';
const GOOGLE_CLIENT_ID = process.env.GCAL_CLIENT_ID || '411548888468-3volgsnl2spba4gcfgik620o0al7pq1v.apps.googleusercontent.com';
const REDIRECT_URI = process.env.GCAL_REDIRECT_URI || 'https://dash.cr8w.com';

export type SharingLevel = 'off' | 'availability' | 'title-time' | 'full-details';
const SHARING_LEVELS = new Set<SharingLevel>(['off', 'availability', 'title-time', 'full-details']);

type Member = { id: string; profile: string; displayName: string; sharingLevel: SharingLevel; encryptedRefreshToken: string };

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase server credentials');
  return createClient(url, key);
}

function encryptionKey(): Buffer {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY not configured');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value: string): string {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted calendar token');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function authToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function currentUser(req: VercelRequest, res: VercelResponse) {
  const token = authToken(req);
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return null; }
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) { res.status(401).json({ error: 'Invalid session' }); return null; }
  const profile = String(data.user.user_metadata?.cr8w_profile || 'member');
  const displayName = String(data.user.user_metadata?.display_name || data.user.email || profile);
  return { id: data.user.id, profile, displayName };
}

async function put(key: string, value: unknown) {
  const { error } = await db().from(TABLE).upsert({ key, value: JSON.stringify(value) });
  if (error) throw new Error(error.message);
}

async function get<T>(key: string): Promise<T | null> {
  const { data, error } = await db().from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return null;
  try { return typeof data.value === 'string' ? JSON.parse(data.value) : data.value; } catch { return null; }
}

async function members(): Promise<Member[]> {
  const { data, error } = await db().from(TABLE).select('value').like('key', 'cr8w_calendar_member_%');
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap(row => {
    try {
      const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      return value?.id && value?.encryptedRefreshToken ? [value as Member] : [];
    } catch { return []; }
  });
}

async function refreshAccessToken(encryptedRefreshToken: string): Promise<string> {
  const secret = process.env.GCAL_CLIENT_SECRET;
  if (!secret) throw new Error('GCAL_CLIENT_SECRET not configured');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: secret, refresh_token: decrypt(encryptedRefreshToken), grant_type: 'refresh_token' }).toString(),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Unable to refresh Google Calendar authorization');
  return body.access_token;
}

function projectEvent(event: any, level: SharingLevel) {
  const start = event.start?.dateTime || event.start?.date || '';
  const end = event.end?.dateTime || event.end?.date || '';
  const base = { start, end, allDay: Boolean(event.start?.date && !event.start?.dateTime) };
  if (level === 'availability') return { ...base, status: 'busy' };
  if (level === 'title-time') return { ...base, title: event.summary || 'Busy' };
  return { ...base, title: event.summary || '(No title)', location: event.location || '', description: event.description || '' };
}

export async function connectCalendar(req: VercelRequest, res: VercelResponse, user: { id: string; profile: string; displayName: string }) {
  const { code, code_verifier, redirect_uri } = req.body || {};
  if (!code || !code_verifier || redirect_uri !== REDIRECT_URI) { res.status(400).json({ error: 'Invalid calendar authorization response' }); return; }
  const secret = process.env.GCAL_CLIENT_SECRET;
  if (!secret) { res.status(500).json({ error: 'GCAL_CLIENT_SECRET not configured' }); return; }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, code_verifier, client_id: GOOGLE_CLIENT_ID, client_secret: secret, redirect_uri, grant_type: 'authorization_code' }).toString(),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.refresh_token) { res.status(400).json({ error: token.error || 'Google authorization did not return a reusable calendar permission' }); return; }
  const previous = await get<Member>(`cr8w_calendar_member_${user.id}`);
  await put(`cr8w_calendar_member_${user.id}`, {
    id: user.id, profile: user.profile, displayName: user.displayName,
    sharingLevel: previous?.sharingLevel || 'off', encryptedRefreshToken: encrypt(token.refresh_token), updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true, sharingLevel: previous?.sharingLevel || 'off' });
}

export async function disconnectCalendar(_req: VercelRequest, res: VercelResponse, user: { id: string }) {
  const { error } = await db().from(TABLE).delete().eq('key', `cr8w_calendar_member_${user.id}`);
  if (error) throw new Error(error.message);
  res.json({ ok: true });
}

export async function getMyCalendar(_req: VercelRequest, res: VercelResponse, user: { id: string }) {
  const member = await get<Member>(`cr8w_calendar_member_${user.id}`);
  if (!member) { res.json({ connected: false, sharingLevel: 'off', events: [] }); return; }
  try {
    const accessToken = await refreshAccessToken(member.encryptedRefreshToken);
    const now = new Date();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString();
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Google Calendar API ${response.status}`);
    const body = await response.json();
    res.json({ connected: true, sharingLevel: member.sharingLevel, calendarName: member.displayName, events: (body.items || []).map((event: any) => projectEvent(event, 'full-details')) });
  } catch (error) {
    console.error(`Calendar unavailable for ${user.id}:`, error);
    res.status(502).json({ error: 'Unable to read your Google Calendar' });
  }
}

export async function updateSharing(req: VercelRequest, res: VercelResponse, user: { id: string }) {
  const level = req.body?.sharingLevel as SharingLevel;
  if (!SHARING_LEVELS.has(level)) { res.status(400).json({ error: 'Invalid sharing level' }); return; }
  const member = await get<Member>(`cr8w_calendar_member_${user.id}`);
  if (!member) { res.status(409).json({ error: 'Connect Google Calendar before enabling sharing' }); return; }
  await put(`cr8w_calendar_member_${user.id}`, { ...member, sharingLevel: level, updatedAt: new Date().toISOString() });
  res.json({ ok: true, sharingLevel: level });
}

export async function getTeamCalendar(_req: VercelRequest, res: VercelResponse) {
  const results = await Promise.all((await members()).filter(member => member.sharingLevel !== 'off').map(async member => {
    try {
      const accessToken = await refreshAccessToken(member.encryptedRefreshToken);
      const now = new Date();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()).toISOString();
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Google Calendar API ${response.status}`);
      const body = await response.json();
      return { profile: member.profile, displayName: member.displayName, sharingLevel: member.sharingLevel, events: (body.items || []).map((event: any) => projectEvent(event, member.sharingLevel)) };
    } catch (error) {
      console.error(`Calendar sharing unavailable for ${member.id}:`, error);
      return null;
    }
  }));
  res.json(results.filter(Boolean));
}
