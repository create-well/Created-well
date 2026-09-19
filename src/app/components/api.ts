import { projectId, publicAnonKey } from '/utils/supabase/info';
// Supabase publishable key — safe to embed (not a secret, designed for public clients).
// Read from env var first so the literal can be rotated without a code change.
const API_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_9iKcrLqFPwPnKmZ4JC3RIg_C15YWSbk'
  || publicAnonKey;

// Pick API base at runtime so the same build works everywhere:
//   • VITE_API_BASE env var  → explicit override (highest priority)
//   • dash.cr8w.com / *.vercel.app / localhost → same-origin /api/server
//   • Figma Make preview → Supabase Edge Function (degraded — verify_jwt:true
//     means the sb_publishable key does NOT authenticate; requests return 401)
function resolveApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE as string;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isFirstParty =
    host.endsWith('.vercel.app') ||
    host === 'cr8w.com' ||
    host.endsWith('.cr8w.com') ||
    host === 'createwell.monnyfest.co' ||
    host.endsWith('.monnyfest.co') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  if (isFirstParty) return '/api/server';
  // Figma Make preview / any other origin — Edge Function path, degraded (401s).
  return `https://${projectId}.supabase.co/functions/v1/make-server-dabe1c74`;
}

const BASE = resolveApiBase();
// /api/dashboard only exists as a Vercel serverless function; not present on the Edge Function.
export const isDashboardAvailable = BASE.endsWith('/server');

function getSessionAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('cr8w_supabase_auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
  } catch {
    return null;
  }
}

export function getApiJsonHeaders(): Record<string, string> {
  const token = getSessionAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: token ? 'Bearer ' + token : API_KEY,
  };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  // One retry for GETs on network-level failures only; mutations fail fast.
  const maxRetries = method === 'GET' ? 1 : 0;
  // Shorter timeout: surface offline state in ≤8 s instead of 30 s.
  const TIMEOUT_MS = 8_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: getApiJsonHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${method} ${path} → ${res.status}: ${text}`);
      }
      return res.json();
    } catch (e: any) {
      lastError = e;
      if (e?.name === 'AbortError') {
        lastError = new Error(`${method} ${path} → timed out after ${TIMEOUT_MS / 1000}s`);
      }
      const isNetworkError = e?.name === 'AbortError' || (e instanceof TypeError && e.message === 'Failed to fetch');
      if (attempt < maxRetries && isNetworkError) {
        await new Promise(r => setTimeout(r, 2_000));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError!;
}

// Sync
export const sync = () => req<SyncData>('GET', '/sync');

// Tasks
export const getTasks = () => req<Task[]>('GET', '/tasks');
export const createTask = (t: Omit<Task, 'id' | 'created_at'>) => req<Task>('POST', '/tasks', t);
export const updateTask = (id: number, t: Partial<Task>) => req<Task>('PUT', `/tasks/${id}`, t);
export const deleteTask = (id: number) => req<{ ok: boolean }>('DELETE', `/tasks/${id}`);

// Stations
export const getStations = () => req<Station[]>('GET', '/stations');
export const createStation = (s: Omit<Station, 'id' | 'created_at'>) => req<Station>('POST', '/stations', s);
export const updateStation = (id: number, s: Partial<Station>) => req<Station>('PUT', `/stations/${id}`, s);
export const deleteStation = (id: number) => req<{ ok: boolean }>('DELETE', `/stations/${id}`);

// Forum
export const getForum = () => req<ForumPost[]>('GET', '/forum');
export const createForumPost = (p: Omit<ForumPost, 'id' | 'created_at'>) => req<ForumPost>('POST', '/forum', p);
export const updateForumPost = (id: number, p: Partial<ForumPost>) => req<ForumPost>('PUT', `/forum/${id}`, p);
export const deleteForumPost = (id: number) => req<{ ok: boolean }>('DELETE', `/forum/${id}`);

// Forum Replies
export const getForumReplies = (postId: number) => req<ForumReply[]>('GET', `/forum/${postId}/replies`);
export const createForumReply = (postId: number, r: { author: string; content: string }) =>
  req<ForumReply>('POST', `/forum/${postId}/replies`, r);
export const getAllForumReplies = () => req<ForumReply[]>('GET', '/forum/replies/all');
export const deleteForumReply = (id: number) => req<{ ok: boolean }>('DELETE', `/forum/replies/${id}`);

// Messages
export const getMessages = () => req<Message[]>('GET', '/messages');
export const sendMessage = (m: Omit<Message, 'id' | 'created_at'>) => req<Message>('POST', '/messages', m);
export const deleteMessage = (id: number) => req<{ ok: boolean }>('DELETE', `/messages/${id}`);
export const updateMessage = (id: number, updates: Partial<Message>) => req<Message>('PUT', `/messages/${id}`, updates);

// Brain Dumps
export const getBrainDumps = () => req<BrainDump[]>('GET', '/braindumps');
export const createBrainDump = (d: Omit<BrainDump, 'id' | 'created_at'>) => req<BrainDump>('POST', '/braindumps', d);
export const deleteBrainDump = (id: number) => req<{ ok: boolean }>('DELETE', `/braindumps/${id}`);

// Announcements
export const getAnnouncements = () => req<Announcement[]>('GET', '/announcements');
export const createAnnouncement = (a: Omit<Announcement, 'id' | 'created_at'>) => req<Announcement>('POST', '/announcements', a);
export const deleteAnnouncement = (id: number) => req<{ ok: boolean }>('DELETE', `/announcements/${id}`);

// Workshops
export const getWorkshops = () => req<Workshop[]>('GET', '/workshops');
export const createWorkshop = (w: Omit<Workshop, 'id' | 'created_at'>) => req<Workshop>('POST', '/workshops', w);
export const updateWorkshop = (id: number, w: Partial<Workshop>) => req<Workshop>('PUT', `/workshops/${id}`, w);
export const deleteWorkshop = (id: number) => req<{ ok: boolean }>('DELETE', `/workshops/${id}`);

// Workshop Programs
export const getWorkshopPrograms = () => req<WorkshopProgram[]>('GET', '/workshop-programs');
export const createWorkshopProgram = (p: Omit<WorkshopProgram, 'id' | 'created_at'>) => req<WorkshopProgram>('POST', '/workshop-programs', p);
export const updateWorkshopProgram = (id: number, p: Partial<WorkshopProgram>) => req<WorkshopProgram>('PUT', `/workshop-programs/${id}`, p);
export const deleteWorkshopProgram = (id: number) => req<{ ok: boolean }>('DELETE', `/workshop-programs/${id}`);

// Workshop Resources
export const getWorkshopResources = () => req<WorkshopResource[]>('GET', '/workshop-resources');
export const createWorkshopResource = (r: Omit<WorkshopResource, 'id' | 'created_at'>) => req<WorkshopResource>('POST', '/workshop-resources', r);
export const deleteWorkshopResource = (id: number) => req<{ ok: boolean }>('DELETE', `/workshop-resources/${id}`);

// CoFlow Dates (behind h0es doors meetings)
export const getCoFlowDates = () => req<CoFlowDate[]>('GET', '/coflow-dates');
export const createCoFlowDate = (d: Omit<CoFlowDate, 'id' | 'created_at'>) => req<CoFlowDate>('POST', '/coflow-dates', d);
export const updateCoFlowDate = (id: number, d: Partial<CoFlowDate>) => req<CoFlowDate>('PUT', `/coflow-dates/${id}`, d);
export const deleteCoFlowDate = (id: number) => req<{ ok: boolean }>('DELETE', `/coflow-dates/${id}`);

// CoFlow Check-ins
export const getCoFlowCheckins = () => req<CoFlowCheckin[]>('GET', '/coflow-checkins');
export const createCoFlowCheckin = (c: Omit<CoFlowCheckin, 'id' | 'created_at'>) => req<CoFlowCheckin>('POST', '/coflow-checkins', c);
export const deleteCoFlowCheckin = (id: number) => req<{ ok: boolean }>('DELETE', `/coflow-checkins/${id}`);

// Well Notes (Notes from the Well — anonymous community exchange)
export const getWellNotes = () => req<WellNote[]>('GET', '/well-notes');
export const createWellNote = (n: { content: string }) => req<WellNote>('POST', '/well-notes', n);
export const updateWellNote = (id: number, n: Partial<WellNote>) => req<WellNote>('PUT', `/well-notes/${id}`, n);

// Settings (generic JSON config storage)
export const getSetting = <T = any>(key: string) => req<{ value: T | null }>('GET', `/settings/${key}`);
export const setSetting = <T = any>(key: string, value: T) => req<{ ok: boolean }>('PUT', `/settings/${key}`, { value });

// Invite Counts (pushed from Google Sheets via Apps Script)
export const getInviteCounts = () => req<InviteCounts>('GET', '/invite-counts');
export const setInviteCounts = (counts: Omit<InviteCounts, 'updated_at'>) => req<InviteCounts & { ok: boolean }>('POST', '/invite-counts', counts);

// Calendar Events (synced from Google Calendar via KV)
export const getCalendarEvents = () => req<CalendarEventKV[]>('GET', '/calendar-events');
export const setCalendarEvents = (events: CalendarEventKV[]) => req<{ ok: boolean; count: number }>('POST', '/calendar-events', events);

// ── /api/dashboard — Notion-backed unified payload ───────────────────────────
// Derives the dashboard URL from the same hostname logic as BASE so that
// Vercel / production / localhost / Figma-preview all resolve correctly.
const DASHBOARD_URL: string = (() => {
  // On Vercel/localhost: resolveApiBase() = '/api/server' → '/api/dashboard' (Vercel function).
  // On Figma Make / other origins: resolveApiBase() = Supabase Edge Function URL (no /server
  // suffix), so this resolves to a non-existent route — fetchDashboard() fails gracefully and
  // the caller falls back to api.sync() against the Edge Function.
  return resolveApiBase().replace(/\/server$/, '') + '/dashboard';
})();

export async function fetchDashboard(): Promise<SyncData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(DASHBOARD_URL, {
      headers: getApiJsonHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fetchDashboard → ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<SyncData>;
  } catch (e: unknown) {
    const err = e as Error;
    if (err?.name === 'AbortError') throw new Error('fetchDashboard timed out after 10s');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Username ↔ email resolution (server-side KV map; enables username sign-in)
export async function lookupUsername(username: string): Promise<string> {
  const res = await fetch(`${BASE}/username-lookup`, {
    method: 'POST',
    headers: getApiJsonHeaders(),
    body: JSON.stringify({ username: username.trim().toLowerCase() }),
  });
  if (!res.ok) throw new Error('Username not found');
  const data = await res.json();
  return data.email as string;
}

export async function registerUsername(username: string, email: string): Promise<void> {
  await req<{ ok: boolean }>('POST', '/register-username', { username, email });
}

// Parking Lot (quick-capture from Playground, KV-backed)
export interface ParkingLotItem {
  id: string;
  text: string;
  category: 'spark' | 'question' | 'resource' | 'wild card';
  author: string;
  created_at: string;
}
export const getParkingLot = () => req<ParkingLotItem[]>('GET', '/parking-lot');
export const addParkingLotItem = (item: Omit<ParkingLotItem, 'id' | 'created_at'>) => req<{ ok: boolean; item: ParkingLotItem }>('POST', '/parking-lot', item);
export const deleteParkingLotItem = (id: string) => req<{ ok: boolean }>('DELETE', `/parking-lot/${id}`);

// ── Types ──────────────────────────────────────────────────────────────────────
export interface InviteCounts {
  confirmed: number;
  pending: number;
  declined: number;
  maybe: number;
  total: number;
  updated_at?: string;
}

export interface Task {
  id: number; person: string; title: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'dropped';
  priority: 'high' | 'medium' | 'low';
  due_date?: string; source?: string; category?: string; created_at?: string;
  notionPageId?: string;
}

export interface Station {
  id: number; emoji: string; name: string; status: string;
  description: string; owner: string; created_at?: string;
  notionPageId?: string;
}

export interface ForumPost {
  id: number; author: string; content: string; tag?: string; created_at?: string;
  notionPageId?: string;
}

export interface ForumReply {
  id: number; postId: number; author: string; content: string; created_at?: string;
}

export interface Message {
  id: number; author: string; content: string;
  tag?: 'urgent' | 'important' | 'pinned' | null;
  reactions?: Record<string, string[]>; // emoji → array of person keys who reacted
  reaction?: string; edited?: boolean; created_at?: string;
}

export interface BrainDump {
  id: number; author: string; content: string; tags?: string; drive_link?: string; created_at?: string;
}

export interface Announcement {
  id: number; text: string; priority: 'high' | 'medium' | 'low'; active?: number; created_at?: string;
}

export interface Workshop {
  id: number;
  title: string;
  description: string;
  facilitator: 'monny' | 'sunshine' | 'bingle' | 'pia' | 'omar' | 'event-support';
  date: string;
  capacity: number;
  participants: number;
  location: string;
  tags: string[];
  googleDocLink?: string;
  status: 'ideation' | 'planning' | 'scheduled' | 'completed';
  created_at?: string;
}

export interface WorkshopProgram {
  id: number;
  seriesName: string;
  description: string;
  learningObjectives: string[];
  sessionOutline: { number: number; title: string; description: string }[];
  targetAudience: string;
  materialsNeeded: string[];
  facilitator: string;
  created_at?: string;
}

export interface WorkshopResource {
  id: number;
  title: string;
  type: 'google-doc' | 'meeting-notes' | 'template' | 'recording';
  url: string;
  lastUpdated: string;
  author: string;
  created_at?: string;
}

export interface CoFlowDate {
  id: number;
  notionPageId?: string;
  date: string;
  timeRange: string;
  startTime?: string;
  endTime?: string;
  location: string;
  host?: string;
  theme?: string;
  rsvp: Record<string, string>;
  agendaItems: { id: number; text: string; lead: string; timeEstimate: number; done: boolean }[];
  agendaLocked?: boolean;
  notes: string;
  vibeCheck: string;
  sessionNotes?: string;
  attendees?: string[];
  status: 'upcoming' | 'active' | 'archived';
  created_at?: string;
}

export interface CoFlowCheckin {
  id: number;
  weekOf: string;
  author: string;
  confirmTime: boolean;
  locationSuggestion: string;
  agendaItems: string[];
  mood?: string;
  timePreference?: string;
  notes?: string;
  created_at?: string;
}

export interface WellNote {
  id: number;
  content: string;
  landed: number;
  created_at?: string;
}

export interface SyncData {
  tasks: Task[];
  stations: Station[];
  forum: ForumPost[];
  messages: Message[];
  braindumps: BrainDump[];
  announcements: Announcement[];
  forumReplies: ForumReply[];
  workshops: Workshop[];
  workshopPrograms: WorkshopProgram[];
  workshopResources: WorkshopResource[];
  coflowDates: CoFlowDate[];
  coflowCheckins: CoFlowCheckin[];
  wellNotes: WellNote[];
  calendarEvents: CalendarEventKV[];
}

export interface CalendarEventKV {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  creator: string;
  synced_at?: string;
}
