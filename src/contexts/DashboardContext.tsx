import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from 'react';
import * as api from '../app/components/api';
import type { Task, Station, ForumPost, Message, BrainDump, Announcement, ForumReply } from '../app/components/api';
import type { Workshop, WorkshopProgram, WorkshopResource } from '../app/components/api';
import type { CoFlowDate, CoFlowCheckin, WellNote } from '../app/components/api';
import {
  DEFAULT_ANNOUNCEMENTS, STATIONS_DEFAULT,
} from '../app/components/data';
import { getStoredProfile } from '../app/components/AuthGate';
import { shouldShowOnboarding } from '../app/components/WelcomeModal';
import type { DashboardContextValue, DashboardPayload, SyncStatus } from '../types/dashboard';

const DEFAULT_STATIONS_MAPPED: Station[] = STATIONS_DEFAULT.map(s => ({
  ...s,
  id: s.id,
  created_at: undefined,
}));

const DashboardCtx = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}

interface DashboardProviderProps {
  children: React.ReactNode;
  onSignOut: () => Promise<void>;
}

export function DashboardProvider({ children, onSignOut }: DashboardProviderProps) {
  // ── Data state ───────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stations, setStations] = useState<Station[]>(DEFAULT_STATIONS_MAPPED);
  const [forum, setForum] = useState<ForumPost[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [brainDumps, setBrainDumps] = useState<BrainDump[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>(DEFAULT_ANNOUNCEMENTS);
  const [forumReplies, setForumReplies] = useState<ForumReply[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workshopPrograms, setWorkshopPrograms] = useState<WorkshopProgram[]>([]);
  const [workshopResources, setWorkshopResources] = useState<WorkshopResource[]>([]);
  const [coFlowDates, setCoFlowDates] = useState<CoFlowDate[]>([]);
  const [coFlowCheckins, setCoFlowCheckins] = useState<CoFlowCheckin[]>([]);
  const [wellNotes, setWellNotes] = useState<WellNote[]>([]);

  // ── Sync metadata ────────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const dataLoadedRef = useRef(false);
  const silentFailCount = useRef(0);
  const fetchSyncRef = useRef<((silent?: boolean) => Promise<void>) | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const initialProfile = getStoredProfile() ?? 'monny';
  const [chatActiveUser, setChatActiveUser] = useState<string>(
    () => { const p = getStoredProfile(); return (p && p !== 'event-support') ? p : 'monny'; }
  );
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(
    () => shouldShowOnboarding(initialProfile === 'event-support' ? 'monny' : initialProfile)
  );
  const [movesDefaultTab, setMovesDefaultTab] = useState<'overview' | 'stations' | 'forum'>('overview');

  useEffect(() => {
    if (shouldShowOnboarding(chatActiveUser)) setShowWelcome(true);
  }, [chatActiveUser]);

  // ── System message helper ────────────────────────────────────────────────────
  const sendSystemMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    setMessages(prev => {
      if (prev.some(m => m.author === 'system' && m.content?.trim() === trimmed)) return prev;
      const tempId = -(Date.now() + Math.random());
      const optimistic: Message = { author: 'system', content, id: tempId, created_at: new Date().toISOString() };
      api.sendMessage({ author: 'system', content })
        .then(created => setMessages(p => p.map(m => m.id === tempId ? created : m)))
        .catch(() => setMessages(p => p.filter(m => m.id !== tempId)));
      return [...prev, optimistic];
    });
  }, []);

  // ── Dedup system messages ────────────────────────────────────────────────────
  function deduplicateSystemMessages(msgs: Message[]): Message[] {
    const seen = new Map<string, Message>();
    const result: Message[] = [];
    for (const m of msgs) {
      if (m.author === 'system') {
        const key = m.content?.trim() || '';
        const existing = seen.get(key);
        if (existing) {
          const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
          const currentTime = m.created_at ? new Date(m.created_at).getTime() : 0;
          if (currentTime > existingTime) {
            const idx = result.indexOf(existing);
            if (idx >= 0) result[idx] = m;
            seen.set(key, m);
          }
        } else {
          seen.set(key, m);
          result.push(m);
        }
      } else {
        result.push(m);
      }
    }
    return result;
  }

  // ── Sync polling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Use /api/dashboard (Notion-backed) as the primary sync source.
    // Fallback: on error keep the last-good payload visible (stale state).
    // Poll floor: 60s — respects the "no polling storms" constraint.
    async function fetchSync(silent = false) {
      try {
        // Try Notion-backed /api/dashboard first; fall back to legacy KV sync
        // on pure network failures (TypeError / AbortError) so local dev and
        // environments where the Vercel function isn't deployed still work.
        let data: Awaited<ReturnType<typeof api.fetchDashboard>>;
        try {
          data = await api.fetchDashboard();
        } catch (primary) {
          const isNetworkErr =
            primary instanceof TypeError ||
            (primary as Error)?.name === 'AbortError' ||
            (primary as Error)?.message?.includes('timed out');
          if (!isNetworkErr) throw primary;
          console.warn('fetchDashboard unreachable, falling back to api.sync():', (primary as Error)?.message);
          data = await api.sync();
        }
        setTasks(data.tasks || []);
        setStations(data.stations?.length ? data.stations : DEFAULT_STATIONS_MAPPED);
        setForum(data.forum || []);
        setMessages(deduplicateSystemMessages(data.messages || []));
        setBrainDumps(data.braindumps || []);
        if (data.announcements?.length) setAnnouncements(data.announcements);
        setForumReplies(data.forumReplies || []);
        setWorkshops(data.workshops || []);
        setWorkshopPrograms(data.workshopPrograms || []);
        setWorkshopResources(data.workshopResources || []);
        setCoFlowDates(data.coflowDates || []);
        setCoFlowCheckins(data.coflowCheckins || []);
        setWellNotes(data.wellNotes || []);
        setSyncStatus('fresh');
        setLastSynced(new Date());
        silentFailCount.current = 0;
        if (!dataLoadedRef.current) { dataLoadedRef.current = true; }
      } catch (e) {
        silentFailCount.current += 1;
        console.error('Dashboard sync error:', e);
        // Show stale data if we've ever loaded; fail hard only on first load.
        if (!dataLoadedRef.current) {
          dataLoadedRef.current = true;
          setSyncStatus('failed');
        } else if (silentFailCount.current >= 2) {
          setSyncStatus('failed');
        }
      }
    }

    fetchSyncRef.current = fetchSync;
    fetchSync(false);

    // 60s floor, 5m ceiling — never hammer Notion or the API cache.
    let pollInterval = 60_000;
    const MAX_INTERVAL = 300_000;

    function schedulePoll() {
      pollRef.current = setTimeout(async () => {
        await fetchSyncRef.current?.(true);
        pollInterval = silentFailCount.current > 0
          ? Math.min(pollInterval * 2, MAX_INTERVAL)
          : 60_000;
        schedulePoll();
      }, pollInterval);
    }
    schedulePoll();

    return () => { if (pollRef.current) clearTimeout(pollRef.current as any); };
  }, []);

  // ── Wednesday reminder ───────────────────────────────────────────────────────
  const wednesdayReminderSent = useRef(false);
  useEffect(() => {
    if (syncStatus === 'loading' || wednesdayReminderSent.current) return;
    const today = new Date();
    if (today.getDay() !== 3) return;
    const key = `cr8w_wed_reminder_${today.toISOString().split('T')[0]}`;
    if (localStorage.getItem(key)) { wednesdayReminderSent.current = true; return; }
    const reminderContent = "[REMINDER] 📋 It's Wednesday! Time to drop your weekly check-in on PlayD8s before the next behind h0es doors. Head to PlayD8s → Check-In tab.";
    if (messages.some(m => m.author === 'system' && m.content?.trim() === reminderContent)) {
      wednesdayReminderSent.current = true;
      localStorage.setItem(key, '1');
      return;
    }
    wednesdayReminderSent.current = true;
    localStorage.setItem(key, '1');
    sendSystemMessage(reminderContent);
  }, [syncStatus, messages, sendSystemMessage]);

  // ── Workshop notify helper ───────────────────────────────────────────────────
  const WELLSHOP_TAG_MAP: Record<string, string[]> = {
    wellshop: ['wellshop', 'reflection', 'grounding', 'journaling', 'inner', 'nurture', 'decomprocess'],
    expresshop: ['expresshop', 'expression', 'sharing', 'presenting', 'pitching', 'storytelling', 'outer'],
    playshop: ['playshop', 'play', 'creative', 'show-and-tell', 'experiment', 'fun'],
  };

  function workshopMatchesCategory(w: Workshop, categoryKey: string): boolean {
    const keywords = WELLSHOP_TAG_MAP[categoryKey] || [];
    const titleLower = w.title.toLowerCase();
    const descLower = w.description.toLowerCase();
    const tagSet = (w.tags || []).map(t => t.toLowerCase());
    return keywords.some(kw => tagSet.includes(kw) || titleLower.includes(kw) || descLower.includes(kw));
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  const actions = {
    // Tasks
    async addTask(item: Omit<Task, 'id' | 'created_at'>) {
      try {
        const created = await api.createTask(item);
        setTasks(prev => [...prev, created]);
        const personLabel = item.person ? item.person.charAt(0).toUpperCase() + item.person.slice(1) : 'Someone';
        sendSystemMessage(`[UPDATE] ⛲️ New Geyser task: "${item.title}" assigned to ${personLabel} (${item.priority} priority)`);
      } catch (e) { console.error('Add task error:', e); }
    },
    async updateTask(id: number, updates: Partial<Task>) {
      try {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        await api.updateTask(id, updates);
      } catch (e) { console.error('Update task error:', e); }
    },
    async updateTaskStatus(id: number, status: Task['status']) {
      try {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        await api.updateTask(id, { status });
      } catch (e) { console.error('Update task status error:', e); }
    },
    async deleteTask(id: number) {
      try {
        setTasks(prev => prev.filter(t => t.id !== id));
        await api.deleteTask(id);
      } catch (e) { console.error('Delete task error:', e); }
    },

    // Stations
    async addStation(s: Omit<Station, 'id' | 'created_at'>) {
      try {
        const created = await api.createStation(s);
        setStations(prev => [...prev, created]);
      } catch (e) { console.error('Add station error:', e); }
    },
    async updateStationStatus(id: number, status: string) {
      try {
        setStations(prev => prev.map(s => s.id === id ? { ...s, status } : s));
        await api.updateStation(id, { status });
      } catch (e) { console.error('Update station status error:', e); }
    },
    async updateStationOwner(id: number, owner: string) {
      try {
        setStations(prev => prev.map(s => s.id === id ? { ...s, owner } : s));
        await api.updateStation(id, { owner });
      } catch (e) { console.error('Update station owner error:', e); }
    },
    async updateStationField(id: number, updates: Partial<Station>) {
      try {
        setStations(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
        await api.updateStation(id, updates);
      } catch (e) { console.error('Update station field error:', e); }
    },
    async deleteStation(id: number) {
      try {
        setStations(prev => prev.filter(s => s.id !== id));
        await api.deleteStation(id);
      } catch (e) { console.error('Delete station error:', e); }
    },

    // Forum
    async addForumPost(post: Omit<ForumPost, 'id' | 'created_at'>) {
      try {
        const created = await api.createForumPost(post);
        setForum(prev => [created, ...prev]);
        const authorLabel = post.author ? post.author.charAt(0).toUpperCase() + post.author.slice(1) : 'Someone';
        sendSystemMessage(`[UPDATE] 💬 ${authorLabel} dropped a new post in The Well${post.tag ? ` [${post.tag}]` : ''}`);
      } catch (e) { console.error('Add forum post error:', e); }
    },
    async updateForumPost(id: number, updates: Partial<ForumPost>) {
      try {
        setForum(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        const updated = await api.updateForumPost(id, updates);
        setForum(prev => prev.map(p => p.id === id ? updated : p));
        const authorLabel = updates.author || forum.find(p => p.id === id)?.author || 'Someone';
        sendSystemMessage(`[UPDATE] ✏️ ${authorLabel.charAt(0).toUpperCase() + authorLabel.slice(1)} edited a post in The Well`);
      } catch (e) { console.error('Update forum post error:', e); }
    },
    async deleteForumPost(id: number) {
      try {
        setForum(prev => prev.filter(p => p.id !== id));
        await api.deleteForumPost(id);
      } catch (e) { console.error('Delete forum post error:', e); }
    },

    // Forum replies
    async addForumReply(postId: number, reply: { author: string; content: string }) {
      const tempId = -Date.now();
      const optimistic: ForumReply = { id: tempId, postId, author: reply.author, content: reply.content, created_at: new Date().toISOString() };
      setForumReplies(prev => [...prev, optimistic]);
      try {
        const created = await api.createForumReply(postId, reply);
        setForumReplies(prev => prev.map(r => r.id === tempId ? { ...created, postId } : r));
      } catch (e) {
        console.error('Add forum reply error:', e);
        setForumReplies(prev => prev.filter(r => r.id !== tempId));
      }
    },
    async deleteForumReply(replyId: number) {
      try {
        setForumReplies(prev => prev.filter(r => r.id !== replyId));
        await api.deleteForumReply(replyId);
      } catch (e) { console.error('Delete forum reply error:', e); }
    },

    // Messages
    async sendMessage(msg: Omit<Message, 'id' | 'created_at'>) {
      const tempId = -Date.now();
      const optimistic: Message = { ...msg, id: tempId, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, optimistic]);
      try {
        const created = await api.sendMessage(msg);
        setMessages(prev => prev.map(m => m.id === tempId ? created : m));
      } catch (e) {
        console.error('Send message error:', e);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    },
    async updateMessage(id: number, content: string) {
      try {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content, edited: true } : m));
        await api.updateMessage(id, { content, edited: true });
      } catch (e) { console.error('Update message error:', e); }
    },
    async updateMessageFields(id: number, fields: Partial<Message>) {
      try {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m));
        await api.updateMessage(id, fields);
      } catch (e) { console.error('Update message fields error:', e); }
    },
    async deleteMessage(id: number) {
      try {
        setMessages(prev => prev.filter(m => m.id !== id));
        await api.deleteMessage(id);
      } catch (e) { console.error('Delete message error:', e); }
    },

    // Brain dumps
    async addBrainDump(dump: Omit<BrainDump, 'id' | 'created_at'>) {
      try {
        const created = await api.createBrainDump(dump);
        setBrainDumps(prev => [created, ...prev]);
      } catch (e) { console.error('Add brain dump error:', e); }
    },
    async deleteBrainDump(id: number) {
      try {
        setBrainDumps(prev => prev.filter(d => d.id !== id));
        await api.deleteBrainDump(id);
      } catch (e) { console.error('Delete brain dump error:', e); }
    },

    // Announcements
    async dismissAnnouncement(id: number) {
      try {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        await api.deleteAnnouncement(id);
      } catch (e) { console.error('Dismiss announcement error:', e); }
    },
    async addAnnouncement() {
      const text = prompt('New announcement:');
      if (!text) return;
      const priority = (prompt('Priority (high, medium, low):') || 'high') as Announcement['priority'];
      try {
        const created = await api.createAnnouncement({ text, priority, active: 1 });
        setAnnouncements(prev => [created, ...prev]);
      } catch (e) { console.error('Add announcement error:', e); }
    },

    // Workshops
    async addWorkshop(w: Omit<Workshop, 'id' | 'created_at'>) {
      try {
        const created = await api.createWorkshop(w);
        setWorkshops(prev => [...prev, created]);
        for (const catKey of ['wellshop', 'expresshop', 'playshop']) {
          if (localStorage.getItem(`wellshop_notify_${catKey}`) === '1' && workshopMatchesCategory(created, catKey)) {
            sendSystemMessage(`🔔 a new ${catKey} just got scheduled: "${created.title}" — you asked to be notified!`);
            break;
          }
        }
      } catch (e) { console.error('Add workshop error:', e); }
    },
    async updateWorkshop(id: number, updates: Partial<Workshop>) {
      try {
        setWorkshops(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
        await api.updateWorkshop(id, updates);
      } catch (e) { console.error('Update workshop error:', e); }
    },
    async deleteWorkshop(id: number) {
      try {
        setWorkshops(prev => prev.filter(w => w.id !== id));
        await api.deleteWorkshop(id);
      } catch (e) { console.error('Delete workshop error:', e); }
    },
    async addWorkshopProgram(p: Omit<WorkshopProgram, 'id' | 'created_at'>) {
      try {
        const created = await api.createWorkshopProgram(p);
        setWorkshopPrograms(prev => [...prev, created]);
      } catch (e) { console.error('Add workshop program error:', e); }
    },
    async updateWorkshopProgram(id: number, updates: Partial<WorkshopProgram>) {
      try {
        setWorkshopPrograms(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        await api.updateWorkshopProgram(id, updates);
      } catch (e) { console.error('Update workshop program error:', e); }
    },
    async deleteWorkshopProgram(id: number) {
      try {
        setWorkshopPrograms(prev => prev.filter(p => p.id !== id));
        await api.deleteWorkshopProgram(id);
      } catch (e) { console.error('Delete workshop program error:', e); }
    },
    async addWorkshopResource(r: Omit<WorkshopResource, 'id' | 'created_at'>) {
      try {
        const created = await api.createWorkshopResource(r);
        setWorkshopResources(prev => [...prev, created]);
      } catch (e) { console.error('Add workshop resource error:', e); }
    },
    async deleteWorkshopResource(id: number) {
      try {
        setWorkshopResources(prev => prev.filter(r => r.id !== id));
        await api.deleteWorkshopResource(id);
      } catch (e) { console.error('Delete workshop resource error:', e); }
    },

    // CoFlow dates
    async addCoFlowDate(d: Omit<CoFlowDate, 'id' | 'created_at'>) {
      try {
        const created = await api.createCoFlowDate(d);
        setCoFlowDates(prev => [...prev, created]);
        const hostLabel = d.host ? capitalize(d.host) : 'Someone';
        const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const timeStr = d.startTime && d.endTime ? `${d.startTime} – ${d.endTime}` : d.timeRange || 'TBD';
        sendSystemMessage(`[UPDATE] 🗓️ New behind h0es doors scheduled! ${dateLabel} · ${timeStr} · ${d.location || 'TBD'}${d.host ? ` · Hosted by ${hostLabel}` : ''}${d.theme ? ` · "${d.theme}"` : ''}`);
      } catch (e) { console.error('Add coflow date error:', e); }
    },
    async updateCoFlowDate(id: number, updates: Partial<CoFlowDate>) {
      try {
        const prev = coFlowDates.find(d => d.id === id);
        setCoFlowDates(p => p.map(d => d.id === id ? { ...d, ...updates } : d));
        await api.updateCoFlowDate(id, updates);
        if (prev && (updates.date || updates.startTime || updates.endTime || updates.location || updates.host || updates.theme) && updates.status !== 'archived') {
          const dateLabel = new Date((updates.date || prev.date) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          sendSystemMessage(`[UPDATE] ✏️ behind h0es doors updated → ${dateLabel} · ${updates.location || prev.location || 'TBD'}`);
        }
        if (updates.status === 'archived' && prev) {
          const dateLabel = new Date(prev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          sendSystemMessage(`[UPDATE] 📚 behind h0es doors (${dateLabel}) has been archived.`);
        }
      } catch (e) { console.error('Update coflow date error:', e); }
    },
    async deleteCoFlowDate(id: number) {
      try {
        const d8 = coFlowDates.find(d => d.id === id);
        setCoFlowDates(prev => prev.filter(d => d.id !== id));
        await api.deleteCoFlowDate(id);
        if (d8) {
          const dateLabel = new Date(d8.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          sendSystemMessage(`[UPDATE] ❌ behind h0es doors on ${dateLabel} has been cancelled.`);
        }
      } catch (e) { console.error('Delete coflow date error:', e); }
    },

    // CoFlow checkins
    async addCoFlowCheckin(c: Omit<CoFlowCheckin, 'id' | 'created_at'>) {
      try {
        const created = await api.createCoFlowCheckin(c);
        setCoFlowCheckins(prev => [...prev, created]);
        const authorLabel = c.author ? c.author.charAt(0).toUpperCase() + c.author.slice(1) : 'Someone';
        const moodEmojis: Record<string, string> = { fire: '🔥', sun: '☀️', cloud: '☁️', rain: '🌧️', storm: '⛈️' };
        const moodStr = c.mood && moodEmojis[c.mood] ? ` ${moodEmojis[c.mood]}` : '';
        const agendaCount = c.agendaItems?.length || 0;
        sendSystemMessage(`[UPDATE] ✅ ${authorLabel} dropped a PlayD8s check-in${moodStr}${agendaCount > 0 ? ` with ${agendaCount} agenda item${agendaCount > 1 ? 's' : ''}` : ''}. ${c.confirmTime ? 'Time confirmed ✓' : 'Time needs adjusting ⚠️'}`);
      } catch (e) { console.error('Add coflow checkin error:', e); }
    },
    async deleteCoFlowCheckin(id: number) {
      try {
        setCoFlowCheckins(prev => prev.filter(c => c.id !== id));
        await api.deleteCoFlowCheckin(id);
      } catch (e) { console.error('Delete coflow checkin error:', e); }
    },

    // Well notes
    async addWellNote(content: string) {
      try {
        const created = await api.createWellNote({ content });
        setWellNotes(prev => [...prev, created]);
        sendSystemMessage('💧 someone dropped a note in the well — pull from the spring to find it');
      } catch (e) { console.error('Add well note error:', e); }
    },
    async landWellNote(id: number) {
      try {
        const note = wellNotes.find(n => n.id === id);
        if (!note) return;
        const updated = await api.updateWellNote(id, { landed: (note.landed || 0) + 1 });
        setWellNotes(prev => prev.map(n => n.id === id ? updated : n));
      } catch (e) { console.error('Land well note error:', e); }
    },

    // Sync + auth
    retrySync() {
      fetchSyncRef.current?.(false);
    },
    async signOut() {
      await onSignOut();
    },
  };

  // ── Compute stale status ─────────────────────────────────────────────────────
  const STALE_THRESHOLD = 5 * 60 * 1000;
  const computedSyncStatus: SyncStatus = syncStatus === 'failed'
    ? 'failed'
    : syncStatus === 'loading'
    ? 'loading'
    : lastSynced && (Date.now() - lastSynced.getTime() > STALE_THRESHOLD)
    ? 'stale'
    : 'fresh';

  const data: DashboardPayload = {
    tasks,
    stations,
    forum,
    messages,
    brainDumps,
    announcements,
    forumReplies,
    workshops,
    workshopPrograms,
    workshopResources,
    coFlowDates,
    coFlowCheckins,
    wellNotes,
    syncStatus: computedSyncStatus,
    lastSynced,
    permissions: {
      careConsent: true,
    },
  };

  const ui = {
    chatActiveUser,
    setChatActiveUser,
    activePerson,
    setActivePerson,
    showWelcome,
    setShowWelcome,
    movesDefaultTab,
    setMovesDefaultTab,
  };

  return (
    <DashboardCtx.Provider value={{ data, actions, ui }}>
      {children}
    </DashboardCtx.Provider>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
