import * as crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Note = { id: number; content: string; landed: number; created_at: string; updated_at: string; source_hash: string };
type Checkin = { id: number; week_of: string | null; author: string; confirm_time: boolean; location_suggestion: string; agenda_items: unknown[]; mood?: string | null; time_preference?: string | null; notes?: string | null; created_at: string; updated_at: string; source_hash: string };
type SheetRow = { values: unknown[]; rowNumber: number };

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const NOTE_HEADERS = ['id', 'content', 'landed', 'created_at', 'updated_at', 'source_hash'];
const CHECKIN_HEADERS = ['id', 'week_of', 'author', 'confirm_time', 'location_suggestion', 'agenda_items', 'mood', 'time_preference', 'notes', 'created_at', 'updated_at', 'source_hash'];

function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function canonicalNoteHash(note: Pick<Note, 'id' | 'content' | 'landed' | 'created_at'>): string {
  return hash([note.id, note.content, note.landed, note.created_at]);
}

function noteValues(note: Note): unknown[] {
  return [note.id, note.content, note.landed, note.created_at, note.updated_at, canonicalNoteHash(note)];
}

export function canonicalCheckinHash(checkin: Pick<Checkin, 'id' | 'week_of' | 'author' | 'confirm_time' | 'location_suggestion' | 'agenda_items' | 'mood' | 'time_preference' | 'notes' | 'created_at'>): string {
  return hash([checkin.id, checkin.week_of, checkin.author, checkin.confirm_time, checkin.location_suggestion, checkin.agenda_items || [], checkin.mood || '', checkin.time_preference || '', checkin.notes || '', checkin.created_at]);
}

function checkinValues(checkin: Checkin): unknown[] {
  return [checkin.id, checkin.week_of || '', checkin.author, checkin.confirm_time, checkin.location_suggestion, JSON.stringify(checkin.agenda_items || []), checkin.mood || '', checkin.time_preference || '', checkin.notes || '', checkin.created_at, checkin.updated_at, canonicalCheckinHash(checkin)];
}

function remoteNoteHash(values: unknown[]): string {
  return hash([Number(values[0]), String(values[1] || ''), Number(values[2] || 0), String(values[3] || '')]);
}

function remoteCheckinHash(values: unknown[]): string {
  let agenda: unknown[] = [];
  try { agenda = JSON.parse(String(values[5] || '[]')); } catch { agenda = [String(values[5] || '')]; }
  return hash([Number(values[0]), String(values[1] || '') || null, String(values[2] || ''), String(values[3]).toLowerCase() === 'true', String(values[4] || ''), agenda, String(values[6] || '') || null, String(values[7] || '') || null, String(values[8] || '') || null, String(values[9] || '')]);
}

async function accessToken(): Promise<string> {
  if (process.env.GOOGLE_SHEETS_ACCESS_TOKEN) return process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Workspace sync is not configured: set GOOGLE_SHEETS_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON');
  const service = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (input: string) => Buffer.from(input).toString('base64url');
  const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64(JSON.stringify({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(service.private_key, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString() });
  const data = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error(`Google token exchange failed: ${data.error || response.statusText}`);
  return data.access_token;
}

async function sheetsRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SHEETS_API}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google Sheets ${response.status}: ${JSON.stringify(data)}`);
  return data as T;
}

async function readSheet(token: string, spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const data = await sheetsRequest<{ values?: unknown[][] }>(token, `${spreadsheetId}/values/${range}?majorDimension=ROWS`);
  return (data.values || []).slice(1).map((values, index) => ({ values, rowNumber: index + 2 }));
}

async function ensureHeader(token: string, spreadsheetId: string, sheetName: string, headers: string[]): Promise<void> {
  const range = encodeURIComponent(`${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`);
  await sheetsRequest(token, `${spreadsheetId}/values/${range}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ range: `${sheetName}!A1`, majorDimension: 'ROWS', values: [headers] }) });
}

async function appendRows(token: string, spreadsheetId: string, sheetName: string, rows: unknown[][]): Promise<void> {
  if (!rows.length) return;
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  await sheetsRequest(token, `${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: rows }) });
}

async function updateRow(token: string, spreadsheetId: string, sheetName: string, rowNumber: number, values: unknown[]): Promise<void> {
  const end = String.fromCharCode(64 + values.length);
  const range = encodeURIComponent(`${sheetName}!A${rowNumber}:${end}${rowNumber}`);
  await sheetsRequest(token, `${spreadsheetId}/values/${range}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ range: `${sheetName}!A${rowNumber}`, majorDimension: 'ROWS', values: [values] }) });
}

export type SyncResult = { status: 'completed' | 'conflict' | 'failed'; notesInserted: number; notesUpdated: number; checkinsInserted: number; checkinsUpdated: number; conflicts: number; error?: string };

export async function syncHistoryToWorkspace(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sb = db();
  const run = await sb.from('workspace_sync_runs').insert({ status: 'running', started_at: startedAt }).select('id').single();
  if (run.error) throw new Error(run.error.message);
  const runId = run.data.id;
  try {
    const spreadsheetId = process.env.GOOGLE_WORKSPACE_SPREADSHEET_ID;
    const notesSheet = process.env.GOOGLE_WORKSPACE_NOTES_SHEET || 'Well Notes';
    const checkinsSheet = process.env.GOOGLE_WORKSPACE_CHECKINS_SHEET || 'Check-ins';
    if (!spreadsheetId) throw new Error('Workspace sync is not configured: set GOOGLE_WORKSPACE_SPREADSHEET_ID');
    const token = await accessToken();
    await ensureHeader(token, spreadsheetId, notesSheet, NOTE_HEADERS);
    await ensureHeader(token, spreadsheetId, checkinsSheet, CHECKIN_HEADERS);

    const [{ data: notes, error: notesError }, { data: checkins, error: checkinsError }] = await Promise.all([
      sb.from('well_notes').select('id,content,landed,created_at,updated_at,source_hash').order('created_at', { ascending: true }).limit(5000),
      sb.from('care_loop_checkins').select('id,week_of,author,confirm_time,location_suggestion,agenda_items,mood,time_preference,notes,created_at,updated_at,source_hash').order('created_at', { ascending: true }).limit(5000),
    ]);
    if (notesError) throw new Error(notesError.message);
    if (checkinsError) throw new Error(checkinsError.message);

    const remoteNotes = await readSheet(token, spreadsheetId, notesSheet);
    const remoteCheckins = await readSheet(token, spreadsheetId, checkinsSheet);
    const conflicts: Array<{ entity_type: string; entity_id: number; sheet_name: string; row_number: number; local_hash: string; remote_hash: string; remote_values: unknown[] }> = [];
    const noteById = new Map(remoteNotes.map(row => [Number(row.values[0]), row]));
    const checkinById = new Map(remoteCheckins.map(row => [Number(row.values[0]), row]));

    for (const note of (notes || []) as Note[]) {
      const values = noteValues(note);
      const localHash = String(values[5]);
      await sb.from('well_notes').update({ source_hash: localHash }).eq('id', note.id);
      const remote = noteById.get(note.id);
      if (remote && String(remote.values[5] || '') !== remoteNoteHash(remote.values) && String(remote.values[5] || '') !== localHash) conflicts.push({ entity_type: 'well_note', entity_id: note.id, sheet_name: notesSheet, row_number: remote.rowNumber, local_hash: localHash, remote_hash: String(remote.values[5] || ''), remote_values: remote.values });
    }
    for (const checkin of (checkins || []) as Checkin[]) {
      const values = checkinValues(checkin);
      const localHash = String(values[11]);
      await sb.from('care_loop_checkins').update({ source_hash: localHash }).eq('id', checkin.id);
      const remote = checkinById.get(checkin.id);
      if (remote && String(remote.values[11] || '') !== remoteCheckinHash(remote.values) && String(remote.values[11] || '') !== localHash) conflicts.push({ entity_type: 'care_loop_checkin', entity_id: checkin.id, sheet_name: checkinsSheet, row_number: remote.rowNumber, local_hash: localHash, remote_hash: String(remote.values[11] || ''), remote_values: remote.values });
    }

    if (conflicts.length) {
      await sb.from('workspace_sync_conflicts').upsert(conflicts.map(conflict => ({ ...conflict, spreadsheet_id: spreadsheetId, remote_values: conflict.remote_values })), { onConflict: 'entity_type,entity_id,spreadsheet_id,sheet_name,row_number' });
      await sb.from('workspace_sync_runs').update({ status: 'conflict', conflicts_count: conflicts.length, completed_at: new Date().toISOString() }).eq('id', runId);
      return { status: 'conflict', notesInserted: 0, notesUpdated: 0, checkinsInserted: 0, checkinsUpdated: 0, conflicts: conflicts.length };
    }

    let notesInserted = 0; let notesUpdated = 0; let checkinsInserted = 0; let checkinsUpdated = 0;
    const newNotes: unknown[][] = [];
    for (const note of (notes || []) as Note[]) {
      const values = noteValues(note); const remote = noteById.get(note.id);
      if (!remote) { newNotes.push(values); notesInserted++; }
      else if (String(remote.values[5] || '') !== String(values[5])) { await updateRow(token, spreadsheetId, notesSheet, remote.rowNumber, values); notesUpdated++; }
    }
    await appendRows(token, spreadsheetId, notesSheet, newNotes);
    const newCheckins: unknown[][] = [];
    for (const checkin of (checkins || []) as Checkin[]) {
      const values = checkinValues(checkin); const remote = checkinById.get(checkin.id);
      if (!remote) { newCheckins.push(values); checkinsInserted++; }
      else if (String(remote.values[11] || '') !== String(values[11])) { await updateRow(token, spreadsheetId, checkinsSheet, remote.rowNumber, values); checkinsUpdated++; }
    }
    await appendRows(token, spreadsheetId, checkinsSheet, newCheckins);
    await sb.from('workspace_sync_runs').update({ status: 'completed', notes_inserted: notesInserted, notes_updated: notesUpdated, checkins_inserted: checkinsInserted, checkins_updated: checkinsUpdated, completed_at: new Date().toISOString() }).eq('id', runId);
    return { status: 'completed', notesInserted, notesUpdated, checkinsInserted, checkinsUpdated, conflicts: 0 };
  } catch (error) {
    await sb.from('workspace_sync_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), completed_at: new Date().toISOString() }).eq('id', runId);
    throw error;
  }
}


type WorkspaceHistory = { notes: Note[]; checkins: Checkin[] };

function isDateValue(value: unknown): boolean {
  return typeof value === 'string' && value.length > 8 && !Number.isNaN(Date.parse(value));
}

function parseWorkspaceNote(row: SheetRow): Note | null {
  const v = row.values;
  const id = Number(v[0]);
  if (!Number.isFinite(id) || !String(v[1] || '').trim()) return null;
  const legacyLayout = isDateValue(v[2]);
  const landed = Number(legacyLayout ? v[3] || 0 : v[2] || 0);
  const createdAt = String(legacyLayout ? v[2] : v[3] || new Date().toISOString());
  const updatedAt = String(legacyLayout ? v[6] || v[2] : v[4] || createdAt);
  return { id, content: String(v[1]), landed: Number.isFinite(landed) ? landed : 0, created_at: createdAt, updated_at: updatedAt, source_hash: String(legacyLayout ? '' : v[5] || '') || remoteNoteHash(v) };
}

function parseWorkspaceCheckin(row: SheetRow): Checkin | null {
  const v = row.values;
  const id = Number(v[0]);
  if (!Number.isFinite(id) || !String(v[2] || v[1] || '').trim()) return null;
  let agenda: unknown[] = [];
  try { agenda = JSON.parse(String(v[5] || v[3] || '[]')); } catch { agenda = [String(v[5] || v[3] || '')]; }
  return { id, week_of: String(v[1] || '') || null, author: String(v[2] || ''), confirm_time: String(v[3]).toLowerCase() === 'true' || String(v[4]).toLowerCase() === 'true', location_suggestion: String(v[4] || ''), agenda_items: agenda, mood: String(v[6] || '') || null, time_preference: String(v[7] || '') || null, notes: String(v[8] || '') || null, created_at: String(v[9] || new Date().toISOString()), updated_at: String(v[10] || v[9] || new Date().toISOString()), source_hash: String(v[11] || '') || remoteCheckinHash(v) };
}

export async function readHistoryFromWorkspace(): Promise<WorkspaceHistory> {
  const spreadsheetId = process.env.GOOGLE_WORKSPACE_SPREADSHEET_ID;
  const notesSheet = process.env.GOOGLE_WORKSPACE_NOTES_SHEET || 'Well Notes';
  const checkinsSheet = process.env.GOOGLE_WORKSPACE_CHECKINS_SHEET || 'Check-ins';
  if (!spreadsheetId) throw new Error('Workspace source is not configured: set GOOGLE_WORKSPACE_SPREADSHEET_ID');
  const token = await accessToken();
  const [noteRows, checkinRows] = await Promise.all([readSheet(token, spreadsheetId, notesSheet), readSheet(token, spreadsheetId, checkinsSheet)]);
  return { notes: noteRows.map(parseWorkspaceNote).filter(Boolean) as Note[], checkins: checkinRows.map(parseWorkspaceCheckin).filter(Boolean) as Checkin[] };
}

export async function syncWorkspaceToDatabase(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sb = db();
  const run = await sb.from('workspace_sync_runs').insert({ status: 'running', started_at: startedAt }).select('id').single();
  if (run.error) throw new Error(run.error.message);
  try {
    const history = await readHistoryFromWorkspace();
    const notes = history.notes.map(note => ({ ...note, source: 'google_sheets', source_hash: canonicalNoteHash(note) }));
    const checkins = history.checkins.map(checkin => ({ ...checkin, source: 'google_sheets', source_hash: canonicalCheckinHash(checkin) }));
    const [{ error: notesError }, { error: checkinsError }] = await Promise.all([
      sb.from('well_notes').upsert(notes, { onConflict: 'id' }),
      sb.from('care_loop_checkins').upsert(checkins, { onConflict: 'id' }),
    ]);
    if (notesError) throw new Error(notesError.message);
    if (checkinsError) throw new Error(checkinsError.message);
    const [{ data: cachedNotes }, { data: cachedCheckins }] = await Promise.all([
      sb.from('well_notes').select('id').limit(5000),
      sb.from('care_loop_checkins').select('id').limit(5000),
    ]);
    const noteIds = new Set(notes.map(note => note.id));
    const checkinIds = new Set(checkins.map(checkin => checkin.id));
    const staleNoteIds = (cachedNotes || []).map(row => Number(row.id)).filter(id => !noteIds.has(id));
    const staleCheckinIds = (cachedCheckins || []).map(row => Number(row.id)).filter(id => !checkinIds.has(id));
    if (staleNoteIds.length) await sb.from('well_notes').delete().in('id', staleNoteIds);
    if (staleCheckinIds.length) await sb.from('care_loop_checkins').delete().in('id', staleCheckinIds);
    await sb.from('workspace_sync_runs').update({ status: 'completed', notes_inserted: notes.length, checkins_inserted: checkins.length, completed_at: new Date().toISOString() }).eq('id', run.data.id);
    return { status: 'completed', notesInserted: notes.length, notesUpdated: 0, checkinsInserted: checkins.length, checkinsUpdated: 0, conflicts: 0 };
  } catch (error) {
    await sb.from('workspace_sync_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), completed_at: new Date().toISOString() }).eq('id', run.data.id);
    throw error;
  }
}

export async function appendWellNoteToWorkspace(content: string): Promise<Note> {
  const spreadsheetId = process.env.GOOGLE_WORKSPACE_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_WORKSPACE_NOTES_SHEET || 'Well Notes';
  if (!spreadsheetId) throw new Error('Workspace source is not configured: set GOOGLE_WORKSPACE_SPREADSHEET_ID');
  const note = { id: Date.now(), content: content.trim(), landed: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source_hash: '' };
  const token = await accessToken();
  await appendRows(token, spreadsheetId, sheetName, [noteValues(note)]);
  return { ...note, source_hash: canonicalNoteHash(note) };
}

export async function updateWellNoteInWorkspace(id: number, landed: number): Promise<Note> {
  const spreadsheetId = process.env.GOOGLE_WORKSPACE_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_WORKSPACE_NOTES_SHEET || 'Well Notes';
  if (!spreadsheetId) throw new Error('Workspace source is not configured: set GOOGLE_WORKSPACE_SPREADSHEET_ID');
  const token = await accessToken();
  const row = (await readSheet(token, spreadsheetId, sheetName)).find(item => Number(item.values[0]) === id);
  if (!row) throw new Error(`Well Note ${id} was not found in Google Sheets`);
  const note = parseWorkspaceNote(row);
  if (!note) throw new Error(`Well Note ${id} has invalid Google Sheets data`);
  const updated = { ...note, landed, updated_at: new Date().toISOString() };
  await updateRow(token, spreadsheetId, sheetName, row.rowNumber, noteValues(updated));
  return { ...updated, source_hash: canonicalNoteHash(updated) };
}


export async function appendCheckinToWorkspace(input: Record<string, unknown>): Promise<Checkin> {
  const spreadsheetId = process.env.GOOGLE_WORKSPACE_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_WORKSPACE_CHECKINS_SHEET || 'Check-ins';
  if (!spreadsheetId) throw new Error('Workspace source is not configured: set GOOGLE_WORKSPACE_SPREADSHEET_ID');
  const checkin: Checkin = {
    id: Date.now(),
    week_of: String(input.weekOf || '') || null,
    author: String(input.author || 'unknown'),
    confirm_time: Boolean(input.confirmTime),
    location_suggestion: String(input.locationSuggestion || ''),
    agenda_items: Array.isArray(input.agendaItems) ? input.agendaItems : [],
    mood: String(input.mood || '') || null,
    time_preference: String(input.timePreference || '') || null,
    notes: String(input.notes || '') || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_hash: '',
  };
  const token = await accessToken();
  await appendRows(token, spreadsheetId, sheetName, [checkinValues(checkin)]);
  return { ...checkin, source_hash: canonicalCheckinHash(checkin) };
}
