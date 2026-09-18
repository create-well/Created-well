import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';
import { PERSONS } from './data';
import type { Message } from './api';
import { showToast } from './Toast';

interface MessageDrawerProps {
  messages: Message[];
  onSend: (msg: Omit<Message, 'id' | 'created_at'>) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, content: string) => Promise<void>;
  onUpdateFields: (id: number, fields: Partial<Message>) => Promise<void>;
  onNavigateToForum?: () => void;
  onNavigateToGeyser?: () => void;
  onNavigateToStations?: () => void;
  onNavigateToPlayD8s?: () => void;
  activeAs: string;
  onSetActiveAs: (person: string) => void;
  onAddWellNote?: (content: string) => void;
}

// ── Message type system ───────────────────────────────────────────────────────
type MsgType = 'message' | 'update' | 'reminder' | 'idea' | 'forum';

const MSG_TYPES: { id: MsgType; label: string; icon: string }[] = [
  { id: 'message',  label: 'Message',    icon: '\u{1F4AC}' },
  { id: 'update',   label: 'Update',     icon: '\u{1F4CC}' },
  { id: 'reminder', label: 'Reminder',   icon: '\u{1F550}' },
  { id: 'idea',     label: 'Idea',       icon: '\u{1F4A1}' },
  { id: 'forum',    label: 'Well Drop',  icon: '\u{1F517}' },
];

const TYPE_PREFIX: Record<MsgType, string> = {
  message:  '',
  update:   '[UPDATE] ',
  reminder: '[REMINDER] ',
  idea:     '[IDEA] ',
  forum:    '[FORUM] ',
};

type ParsedPrefix = 'UPDATE' | 'REMINDER' | 'IDEA' | 'FORUM' | null;

function parseMsg(content: string): { prefix: ParsedPrefix; body: string } {
  const m = content.match(/^\[(UPDATE|REMINDER|IDEA|FORUM)\] ([\s\S]*)/);
  if (m) return { prefix: m[1] as ParsedPrefix, body: m[2] };
  return { prefix: null, body: content };
}

// ── Priority tag system ───────────────────────────────────────────────────────
type MsgTag = 'urgent' | 'important' | 'pinned' | null;

const TAG_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  urgent:    { emoji: '\u{1F525}', label: 'URGENT',    color: '#FF453A', bg: 'rgba(255,69,58,0.15)' },
  important: { emoji: '\u2B50',    label: 'IMPORTANT', color: '#FFD60A', bg: 'rgba(255,214,10,0.12)' },
  pinned:    { emoji: '\u{1F4CC}', label: 'PINNED',    color: '#30D158', bg: 'rgba(48,209,88,0.12)' },
};

// ── Reaction system ───────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['\u{1FAF6}', '\u{1F4A7}', '\u{1F525}', '\u2728', '\u{1F300}'];

// ── Chat sender colors (for bubble left borders) ─────────────────────────────
const SENDER_COLORS: Record<string, string> = {
  sunshine: '#E8C875',
  monny:    '#7BA89D',
  bingle:   '#B8A9D4',
};

// ── localStorage-based reactions ─────────────────────────────────────────────
const LS_REACTIONS_KEY = 'cr8w_chat_reactions';

function loadLocalReactions(): Record<number, Record<string, string[]>> {
  try {
    const raw = localStorage.getItem(LS_REACTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocalReactions(data: Record<number, Record<string, string[]>>) {
  try {
    localStorage.setItem(LS_REACTIONS_KEY, JSON.stringify(data));
  } catch {
    showToast('\u26A0\uFE0F couldn\u2019t save \u2014 try again', 'alert');
  }
}

// ── Local reply threads ───────────────────────────────────────────────────────
type ChatReply = { id: number; author: string; content: string; ts: string };

// ── Sync messages ─────────────────────────────────────────────────────────────
type SyncMsg = Message & { isSync: true };
type AnyMsg = (Message | SyncMsg) & { isSync?: boolean };

function formatMsgTime(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Is system-generated message?
function isSystemMsg(m: AnyMsg): boolean {
  return m.author === 'system' || !!(m as SyncMsg).isSync;
}

// Determine if a message counts as "focus" content
function isFocusMsg(m: AnyMsg): boolean {
  if (isSystemMsg(m)) return false; // system msgs hidden in focus
  const { prefix } = parseMsg(m.content || '');
  if (prefix === 'REMINDER') return true;
  if ((m.content || '').includes('@')) return true;
  if ((m as Message).tag === 'urgent' || (m as Message).tag === 'pinned') return true;
  return false;
}

// ── Filter modes ──────────────────────────────────────────────────────────────
type FilterMode = 'all' | 'pinned' | 'urgent';

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadIdSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

function saveIdSet(key: string, set: Set<number>) {
  try {
    // Only keep last 500 entries to prevent unbounded growth
    const arr = [...set].slice(-500);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch { /* storage full – ignore */ }
}

// ── Navigation link style ──────────────────────────────────────────────────
const navLinkStyle: React.CSSProperties = {
  color: '#7BA89D', cursor: 'pointer',
  fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700,
  letterSpacing: '0.03em', background: 'none', border: 'none',
  padding: 0, textDecoration: 'none', transition: 'color 0.15s',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function MessageDrawer({
  messages, onSend, onDelete, onUpdate, onUpdateFields,
  onNavigateToForum, onNavigateToGeyser, onNavigateToStations, onNavigateToPlayD8s,
  activeAs, onSetActiveAs, onAddWellNote,
}: MessageDrawerProps) {
  const [open,           setOpen]           = useState(false);
  const [text,           setText]           = useState('');
  const [msgType,        setMsgType]        = useState<MsgType>('message');
  const [sending,        setSending]        = useState(false);
  const [focusMode,      setFocusMode]      = useState(false);
  const [replyToId,      setReplyToId]      = useState<number | null>(null);
  const [chatReplies,    setChatReplies]    = useState<Record<number, ChatReply[]>>({});
  const [openReplies,    setOpenReplies]    = useState<Set<number>>(new Set());
  const [msgMenu,        setMsgMenu]        = useState<number | null>(null);
  const [reactionPicker, setReactionPicker] = useState<number | null>(null);
  const [filterMode,     setFilterMode]     = useState<FilterMode>('all');
  const [activeTag,      setActiveTag]      = useState<MsgTag>(null);
  const [hoveredMsgId,   setHoveredMsgId]   = useState<number | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<number, Record<string, string[]>>>(loadLocalReactions);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit state
  const [editingId,      setEditingId]      = useState<number | null>(null);
  const [editText,       setEditText]       = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ── CALM DEFAULT: hidden panels ──
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [showFilters,      setShowFilters]      = useState(false);
  const [inputFocused,     setInputFocused]     = useState(false);
  const [showOlderMsgs,    setShowOlderMsgs]    = useState(false);

  // ── READ/UNREAD TRACKING ──
  const readKey = `cr8w_read_${activeAs}`;
  const [readIds, setReadIds] = useState<Set<number>>(() => loadIdSet(readKey));

  // ── LINK TAP TRACKING ──
  const tappedKey = `cr8w_tapped_${activeAs}`;
  const [tappedIds, setTappedIds] = useState<Set<number>>(() => loadIdSet(tappedKey));

  // ── DISMISSED NOTIFICATIONS ──
  const dismissedKey = `cr8w_dismissed_${activeAs}`;
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => loadIdSet(dismissedKey));

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  // Reload localStorage sets when user switches
  useEffect(() => {
    setReadIds(loadIdSet(`cr8w_read_${activeAs}`));
    setTappedIds(loadIdSet(`cr8w_tapped_${activeAs}`));
    setDismissedIds(loadIdSet(`cr8w_dismissed_${activeAs}`));
  }, [activeAs]);

  // Persist sets on change
  useEffect(() => { saveIdSet(readKey, readIds); }, [readIds, readKey]);
  useEffect(() => { saveIdSet(tappedKey, tappedIds); }, [tappedIds, tappedKey]);
  useEffect(() => { saveIdSet(dismissedKey, dismissedIds); }, [dismissedIds, dismissedKey]);

  // Mark user's own messages as read automatically
  useEffect(() => {
    const ownIds = messages.filter(m => m.author === activeAs).map(m => m.id);
    if (ownIds.length > 0) {
      setReadIds(prev => {
        const next = new Set(prev);
        let changed = false;
        ownIds.forEach(id => { if (!next.has(id)) { next.add(id); changed = true; } });
        return changed ? next : prev;
      });
    }
  }, [messages, activeAs]);

  // ── IntersectionObserver for auto-read ──
  const observerRef = useRef<IntersectionObserver | null>(null);
  const timerMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const markAsRead = useCallback((id: number) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = Number(entry.target.getAttribute('data-msg-id'));
        if (!id || isNaN(id)) return;
        if (entry.isIntersecting) {
          if (!timerMap.current.has(id)) {
            timerMap.current.set(id, setTimeout(() => {
              markAsRead(id);
              timerMap.current.delete(id);
            }, 2000));
          }
        } else {
          const t = timerMap.current.get(id);
          if (t) { clearTimeout(t); timerMap.current.delete(id); }
        }
      });
    }, { threshold: 0.5 });

    return () => {
      observerRef.current?.disconnect();
      timerMap.current.forEach(t => clearTimeout(t));
      timerMap.current.clear();
    };
  }, [open, markAsRead]);

  // Ref callback to observe message elements
  const observeMsg = useCallback((el: HTMLDivElement | null) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320);
  }, [open]);

  useEffect(() => {
    if (editingId !== null) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editingId]);

  useEffect(() => {
    if (msgMenu === null) return;
    const dismiss = () => setMsgMenu(null);
    document.addEventListener('click', dismiss, { once: true });
    return () => document.removeEventListener('click', dismiss);
  }, [msgMenu]);

  // ── Computed: unread count ──
  const unreadMsgIds = useMemo(() => {
    return messages.filter(m => m.id > 0 && !readIds.has(m.id) && !dismissedIds.has(m.id)).map(m => m.id);
  }, [messages, readIds, dismissedIds]);

  const unreadCount = unreadMsgIds.length;

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    // Titration Dial: quiet mode uses anonymous author
    const quietMode = parseInt(localStorage.getItem('visibilityDial') || '1') === 0;
    const sendAuthor = quietMode ? 'a co-creator' : activeAs;
    try {
      if (replyToId !== null) {
        const reply: ChatReply = { id: Date.now(), author: sendAuthor, content: text.trim(), ts: 'just now' };
        setChatReplies(prev => ({ ...prev, [replyToId]: [...(prev[replyToId] || []), reply] }));
        setOpenReplies(prev => new Set([...prev, replyToId]));
        setReplyToId(null);
      } else {
        const msgPayload: Omit<Message, 'id' | 'created_at'> = {
          author: sendAuthor,
          content: TYPE_PREFIX[msgType] + text.trim(),
        };
        if (activeTag) msgPayload.tag = activeTag;
        await onSend(msgPayload);
      }
      setText('');
      setActiveTag(null);
      setMsgType('message');
    } catch (e) {
      console.error('MessageDrawer send error:', e);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Tag toggle ──────────────────────────────────────────────────────────────
  function toggleTag(tag: MsgTag) { setActiveTag(prev => prev === tag ? null : tag); }

  async function toggleMsgTag(msgId: number, tag: MsgTag) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const newTag = msg.tag === tag ? null : tag;
    await onUpdateFields(msgId, { tag: newTag });
    setMsgMenu(null);
  }

  // ── Reaction toggle (localStorage) ──────────────────────────────────────────
  function toggleReaction(msgId: number, emoji: string) {
    setLocalReactions(prev => {
      const next = { ...prev };
      if (!next[msgId]) next[msgId] = {};
      const users = next[msgId][emoji] ? [...next[msgId][emoji]] : [];
      const idx = users.indexOf(activeAs);
      if (idx >= 0) users.splice(idx, 1);
      else users.push(activeAs);
      if (users.length > 0) next[msgId] = { ...next[msgId], [emoji]: users };
      else { const r = { ...next[msgId] }; delete r[emoji]; next[msgId] = r; }
      if (Object.keys(next[msgId]).length === 0) delete next[msgId];
      saveLocalReactions(next);
      return next;
    });
    setReactionPicker(null);
    setHoveredMsgId(null);
  }

  // ── Water-drop shortcut: copy to Notes from the Well ──────────────────────
  function sendToWell(msg: AnyMsg) {
    const { body } = parseMsg(msg.content || '');
    if (onAddWellNote && body.trim()) {
      onAddWellNote(body.trim());
      showToast('\u{1F4A7} dropped in the well.', 'well');
    }
    setHoveredMsgId(null);
  }

  // ── Hover / long-press handlers ───────────────────────────────────────────
  function handleMsgPointerEnter(id: number) { setHoveredMsgId(id); }
  function handleMsgPointerLeave() { setHoveredMsgId(null); if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }
  function handleMsgTouchStart(id: number) { longPressRef.current = setTimeout(() => setHoveredMsgId(id), 400); }
  function handleMsgTouchEnd() { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function startEdit(msg: AnyMsg) {
    const { body } = parseMsg(msg.content || '');
    setEditingId(msg.id);
    setEditText(body);
    setMsgMenu(null);
  }

  async function commitEdit() {
    if (editingId === null || !editText.trim()) { cancelEdit(); return; }
    const origMsg = messages.find(m => m.id === editingId);
    if (!origMsg) { cancelEdit(); return; }
    const { prefix } = parseMsg(origMsg.content || '');
    const prefixStr = prefix ? `[${prefix}] ` : '';
    await onUpdate(editingId, prefixStr + editText.trim());
    cancelEdit();
  }

  function cancelEdit() { setEditingId(null); setEditText(''); }

  // ── Delete handlers ───────────────────────────────────────────────────────
  function confirmDelete(id: number) { setDeleteConfirmId(id); setMsgMenu(null); }
  function executeDelete() {
    if (deleteConfirmId === null) return;
    onDelete(deleteConfirmId);
    setDeleteConfirmId(null);
  }

  // ── Dismiss notification ──
  function dismissMsg(id: number) {
    setDismissedIds(prev => { const n = new Set(prev); n.add(id); return n; });
  }

  function undismissAll() {
    setDismissedIds(new Set());
  }

  // ── Navigation detection ──────────────────────────────────────────────────
  function getNavTarget(content: string): { label: string; action: (() => void) | null } {
    const lower = content.toLowerCase();
    if (lower.includes('playd8s') || lower.includes('check-in') || lower.includes('wednesday') || lower.includes('co-flow'))
      return { label: 'Go to PlayD8s \u2192', action: onNavigateToPlayD8s || null };
    if (lower.includes('the well') || lower.includes('forum') || lower.includes('well post') || lower.includes('well drop') || lower.includes('posted') || lower.includes('[forum]'))
      return { label: 'Go to The Well \u2192', action: onNavigateToForum || null };
    if (lower.includes('station'))
      return { label: 'Go to Stations \u2192', action: onNavigateToStations || null };
    if (lower.includes('geyser') || lower.includes('task'))
      return { label: 'Go to Geyser \u2192', action: onNavigateToGeyser || null };
    return { label: 'Go to The Well \u2192', action: onNavigateToForum || null };
  }

  function handleNavClick(msgId: number, action: (() => void) | null) {
    if (action) {
      // Mark as tapped
      setTappedIds(prev => { const n = new Set(prev); n.add(msgId); return n; });
      markAsRead(msgId);
      setOpen(false);
      setTimeout(() => action(), 80);
    }
  }

  // ── Pinned messages ───────────────────────────────────────────────────────
  const pinnedMsgs = useMemo(() => messages.filter(m => m.tag === 'pinned'), [messages]);
  const pinnedCount = pinnedMsgs.length;
  const urgentCount = useMemo(() => messages.filter(m => m.tag === 'urgent').length, [messages]);

  // ── All messages: sorted, filtered, grouped ───────────────────────────────
  const allMsgs: AnyMsg[] = useMemo(() => {
    let base: AnyMsg[] = [...messages];
    if (filterMode === 'pinned') base = base.filter(m => (m as Message).tag === 'pinned');
    else if (filterMode === 'urgent') base = base.filter(m => (m as Message).tag === 'urgent' || (m as Message).tag === 'important');
    return base.sort((a, b) =>
      (a.created_at ? new Date(a.created_at).getTime() : 0) -
      (b.created_at ? new Date(b.created_at).getTime() : 0)
    );
  }, [messages, filterMode]);

  // ── Smart grouping: NEW (unread) | EARLIER TODAY | older (collapsed) ──
  const { newMsgs, earlierTodayMsgs, olderMsgs, dismissedMsgs } = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const newM: AnyMsg[] = [];
    const earlierM: AnyMsg[] = [];
    const olderM: AnyMsg[] = [];
    const dismissedM: AnyMsg[] = [];

    for (const m of allMsgs) {
      if (dismissedIds.has(m.id)) { dismissedM.push(m); continue; }
      const ts = m.created_at ? new Date(m.created_at) : new Date();
      const isToday = ts >= todayStart;
      const isRead = readIds.has(m.id) || m.author === activeAs;

      if (!isRead) newM.push(m);
      else if (isToday) earlierM.push(m);
      else olderM.push(m);
    }

    return { newMsgs: newM, earlierTodayMsgs: earlierM, olderMsgs: olderM, dismissedMsgs: dismissedM };
  }, [allMsgs, readIds, dismissedIds, activeAs]);

  // Focus mode filtering
  const focusFilteredNew = focusMode ? newMsgs.filter(m => isFocusMsg(m)) : newMsgs;
  const focusFilteredEarlier = focusMode ? earlierTodayMsgs.filter(m => isFocusMsg(m)) : earlierTodayMsgs;
  const focusFilteredOlder = focusMode ? olderMsgs.filter(m => isFocusMsg(m)) : olderMsgs;

  const activeP = PERSONS[activeAs];
  const replyTarget = replyToId !== null ? messages.find(m => m.id === replyToId) : null;

  // ── Whether to show digest (only when new items) ──
  const hasNewItems = unreadCount > 0;

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderReactions(msg: AnyMsg) {
    const reactions = localReactions[msg.id];
    if (!reactions || Object.keys(reactions).length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
        {Object.entries(reactions).map(([emoji, users]) => {
          const iReacted = users.includes(activeAs);
          return (
            <button key={emoji} onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: iReacted ? 'rgba(123,168,157,0.2)' : '#2c2c2e',
                border: iReacted ? '1px solid rgba(123,168,157,0.5)' : '1px solid #3a3a3c',
                borderRadius: 14, padding: '3px 9px', cursor: 'pointer',
                fontSize: '0.72rem', color: '#ebebf5', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '0.8rem' }}>{emoji}</span>
              <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '0.65rem' }}>{users.length}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderTagBadge(msg: AnyMsg) {
    const tag = (msg as Message).tag;
    if (!tag || !TAG_META[tag]) return null;
    const t = TAG_META[tag];
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: t.bg, border: `1px solid ${t.color}44`,
        borderRadius: 8, padding: '1px 6px', marginLeft: 4,
        fontSize: '0.55rem', fontWeight: 700, color: t.color,
        fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{t.emoji} {t.label}</span>
    );
  }

  // ── System/Sync message (quiet style) ──────────────────────────────────────
  function renderSystemMsg(msg: AnyMsg) {
    const { prefix, body } = parseMsg(msg.content || '');
    const nav = getNavTarget(msg.content || '');
    const isUnread = !readIds.has(msg.id) && msg.author !== activeAs;
    const isTapped = tappedIds.has(msg.id);
    const isDismissed = dismissedIds.has(msg.id);

    return (
      <div
        key={msg.id}
        ref={isUnread ? observeMsg : undefined}
        data-msg-id={msg.id}
        style={{
          margin: '6px 0',
          animation: 'msgFadeIn 0.35s ease',
          opacity: isDismissed ? 0.4 : isTapped ? 0.55 : 1,
          transition: 'opacity 0.3s',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: isUnread ? 'rgba(169,214,248,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${isUnread ? 'rgba(169,214,248,0.18)' : 'rgba(255,255,255,0.04)'}`,
          borderLeft: '3px dashed rgba(184,184,184,0.5)',
          borderRadius: 14, padding: '10px 14px',
          transition: 'all 0.3s',
          position: 'relative',
        }}>
          <span style={{ fontSize: '0.78rem', flexShrink: 0, opacity: 0.7 }}>
            {prefix === 'FORUM' ? '\u{1F517}' : prefix === 'REMINDER' ? '\u{1F550}' : '\u{1F4E1}'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Montserrat, system-ui, sans-serif',
              fontSize: isUnread ? '0.78rem' : '0.74rem',
              color: isUnread ? '#c8d8e8' : '#8e8e93',
              lineHeight: 1.5,
              fontWeight: isUnread ? 500 : 400,
            }}>{body}</div>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.58rem', color: '#4a4a4e',
              textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 5,
              display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
            }}>
              {formatMsgTime(msg.created_at)} {'\u00B7'} {prefix === 'FORUM' ? 'Well Sync' : prefix === 'REMINDER' ? 'Reminder' : 'System'}
              {nav.action && (
                <>
                  {' '}{'\u00B7'}{' '}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNavClick(msg.id, nav.action); }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    style={navLinkStyle}
                  >
                    {isTapped ? '\u2705 Visited' : nav.label}
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Dismiss X */}
          {!isDismissed && (
            <button
              onClick={(e) => { e.stopPropagation(); dismissMsg(msg.id); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4a4a4e', fontSize: '0.75rem', padding: '2px 4px',
                flexShrink: 0, opacity: 0.6, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              title="Dismiss"
            >{'\u00D7'}</button>
          )}
        </div>
      </div>
    );
  }

  // ── Floating reaction bar ─────────────────────────────────────────────────
  function renderHoverBar(msg: AnyMsg, isMine: boolean) {
    if (hoveredMsgId !== msg.id) return null;
    return (
      <div
        style={{
          position: 'absolute',
          top: -36,
          [isMine ? 'right' : 'left']: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: '#fff',
          borderRadius: 22,
          padding: '4px 6px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          animation: 'msgFadeIn 0.15s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map(r => (
          <button key={r} onClick={() => toggleReaction(msg.id, r)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.95rem', padding: '2px 4px', borderRadius: 8,
              transition: 'transform 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >{r}</button>
        ))}
        {/* Water-drop shortcut */}
        {onAddWellNote && (
          <>
            <span style={{ width: 1, height: 16, background: '#e0e0e0', margin: '0 2px', flexShrink: 0 }} />
            <button
              onClick={() => sendToWell(msg)}
              title="Send to the Well"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', padding: '2px 4px', borderRadius: 8,
                transition: 'transform 0.12s',
                opacity: 0.7,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.7'; }}
            >{'\u{1F4A7}'}</button>
          </>
        )}
      </div>
    );
  }

  // ── User message bubble ──────────────────────────────────────────────────
  function renderBubble(msg: AnyMsg, idx: number, groupMsgs: AnyMsg[]) {
    const isMine   = msg.author === activeAs;
    const p        = PERSONS[msg.author];
    const pColor   = p?.color || '#A89888';
    const senderColor = SENDER_COLORS[msg.author] || pColor;
    const prev     = idx > 0 ? groupMsgs[idx - 1] : null;
    const next     = idx < groupMsgs.length - 1 ? groupMsgs[idx + 1] : null;
    const showHead = !prev || prev.author !== msg.author || isSystemMsg(prev);
    const showTail = !next || next.author !== msg.author || isSystemMsg(next);
    const isMenu   = msgMenu === msg.id;
    const replies  = chatReplies[msg.id] || [];
    const { prefix, body } = parseMsg(msg.content || '');
    const isEditing = editingId === msg.id;
    const isDelConfirm = deleteConfirmId === msg.id;
    const isEdited = (msg as Message).edited;
    const msgTag   = (msg as Message).tag;
    const isUnread = !readIds.has(msg.id) && !isMine;

    // Focus mode: hide non-focus msgs
    const msgOpacity = focusMode && !isFocusMsg(msg) ? 0 : 1;
    const msgDisplay = focusMode && !isFocusMsg(msg) ? 'none' : undefined;

    // Bubble background: sage green at 12% opacity
    const bubbleBg = 'rgba(123,168,157,0.12)';

    const tagBorder = msgTag && TAG_META[msgTag] ? `2px solid ${TAG_META[msgTag].color}44` : undefined;

    const TYPE_BADGE: Partial<Record<ParsedPrefix, { icon: string; label: string; color: string }>> = {
      UPDATE:   { icon: '\u{1F4CC}', label: 'Update',   color: '#E8A090' },
      REMINDER: { icon: '\u{1F550}', label: 'Reminder', color: '#FF9F0A' },
      IDEA:     { icon: '\u{1F4A1}', label: 'Idea',      color: '#FFD60A' },
    };
    const badge = prefix ? TYPE_BADGE[prefix] : null;

    // Forum-type user bubble
    if (prefix === 'FORUM') {
      return (
        <div key={msg.id} ref={isUnread ? observeMsg : undefined} data-msg-id={msg.id}
          style={{ margin: '5px 0 12px', display: msgDisplay || 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end', animation: 'msgFadeIn 0.35s ease', opacity: msgOpacity }}
          onMouseEnter={() => handleMsgPointerEnter(msg.id)}
          onMouseLeave={handleMsgPointerLeave}
          onTouchStart={() => handleMsgTouchStart(msg.id)}
          onTouchEnd={handleMsgTouchEnd}
        >
          {!isMine && (
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: `${pColor}33`, border: `1.5px solid ${pColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}>
              {p?.emoji || '\u{1F464}'}
            </div>
          )}
          <div style={{ maxWidth: '76%', position: 'relative' }}>
            <div style={{ background: 'rgba(123,168,157,0.12)', border: '1px solid #3a3a3c', borderLeft: `3px solid ${senderColor}`, borderRadius: 14, padding: '10px 14px', position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: pColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                {'\u{1F517}'} Well Drop {'\u00B7'} {p?.name}{renderTagBadge(msg)}
              </div>
              <div style={{ fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '0.86rem', color: '#e5e5ea', lineHeight: 1.45 }}>{body}</div>
              {renderHoverBar(msg, isMine)}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#4a4a4e', marginTop: 4, paddingLeft: 4 }}>{formatMsgTime(msg.created_at)}</div>
            {renderReactions(msg)}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} ref={isUnread ? observeMsg : undefined} data-msg-id={msg.id}
        style={{ marginBottom: showTail ? 12 : 4, opacity: msgOpacity, display: msgDisplay, transition: 'opacity 0.2s', animation: 'msgFadeIn 0.35s ease' }}>
        {/* Type divider */}
        {prefix && showHead && (
          <div style={{ textAlign: isMine ? 'right' : 'left', padding: '6px 38px 3px', opacity: 0.5 }}>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.56rem', color: badge?.color || '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {badge?.icon} {badge?.label}
            </span>
          </div>
        )}

        <div
          style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, position: 'relative', cursor: 'pointer' }}
          onClick={() => { if (!isEditing) setMsgMenu(isMenu ? null : msg.id); }}
          onMouseEnter={() => handleMsgPointerEnter(msg.id)}
          onMouseLeave={handleMsgPointerLeave}
          onTouchStart={() => handleMsgTouchStart(msg.id)}
          onTouchEnd={handleMsgTouchEnd}
        >
          {/* Avatar */}
          {!isMine && (
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `${pColor}33`, border: `1.5px solid ${pColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem',
              visibility: showHead || showTail ? 'visible' : 'hidden',
            }}>{p?.emoji || '\u{1F464}'}</div>
          )}

          <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            {!isMine && showHead && (
              <span style={{ fontSize: '0.68rem', color: pColor, fontWeight: 600, marginBottom: 3, paddingLeft: 4, fontFamily: 'var(--font-label)', display: 'inline-flex', alignItems: 'center' }}>
                {p?.name}{renderTagBadge(msg)}
              </span>
            )}
            {isMine && showHead && msgTag && (
              <span style={{ marginBottom: 3, paddingRight: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {renderTagBadge(msg)}
              </span>
            )}

            {/* Edit mode */}
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 180, maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
                <input ref={editInputRef} value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') cancelEdit(); }}
                  style={{
                    background: '#3a3a3c', border: '1.5px solid #7BA89D',
                    borderRadius: 16, padding: '9px 14px', color: '#fff',
                    fontSize: '0.88rem', fontFamily: 'Montserrat, system-ui, sans-serif', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <button onClick={commitEdit} style={{ background: '#7BA89D', border: 'none', color: '#fff', borderRadius: 10, padding: '5px 14px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-label)', fontWeight: 700 }}>Save</button>
                  <button onClick={cancelEdit} style={{ background: '#3a3a3c', border: 'none', color: '#8e8e93', borderRadius: 10, padding: '5px 14px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-label)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                <div style={{
                  background: bubbleBg, color: '#fff',
                  padding: '10px 14px',
                  borderRadius: isMine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  fontSize: '0.88rem', lineHeight: 1.5, wordBreak: 'break-word',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  position: 'relative',
                  borderLeft: `3px solid ${senderColor}`,
                  borderTop: tagBorder || '1px solid rgba(255,255,255,0.04)',
                  borderRight: tagBorder || '1px solid rgba(255,255,255,0.04)',
                  borderBottom: tagBorder || '1px solid rgba(255,255,255,0.04)',
                  boxShadow: isUnread ? `0 0 0 1px ${senderColor}44` : undefined,
                }}>
                  {body}
                  {renderHoverBar(msg, isMine)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: 1, flexShrink: 0, paddingBottom: 2 }}>
                  <span style={{ fontSize: '0.62rem', color: '#4a4a4e' }}>{formatMsgTime(msg.created_at)}</span>
                  {isEdited && <span style={{ fontSize: '0.55rem', color: '#4a4a4e', fontStyle: 'italic', fontFamily: 'var(--font-label)' }}>(edited)</span>}
                </div>
              </div>
            )}

            {!isEditing && renderReactions(msg)}
          </div>
        </div>

        {/* Action menu */}
        {isMenu && !isEditing && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start', padding: '5px 38px 3px', gap: 5 }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setReplyToId(msg.id); setMsgMenu(null); setTimeout(() => inputRef.current?.focus(), 100); }}
              style={menuBtnStyle('#ebebf5')}>{'\u21A9'} Reply</button>
            <button onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
              style={menuBtnStyle('#ebebf5')}>{'\u{1F600}'} React</button>
            {!(msg as SyncMsg).isSync && (
              <>
                <button onClick={() => toggleMsgTag(msg.id, 'urgent')} style={menuBtnStyle(msgTag === 'urgent' ? '#FF453A' : '#8e8e93')}>
                  {'\u{1F525}'}{msgTag === 'urgent' ? ' \u2713' : ''}
                </button>
                <button onClick={() => toggleMsgTag(msg.id, 'important')} style={menuBtnStyle(msgTag === 'important' ? '#FFD60A' : '#8e8e93')}>
                  {'\u2B50'}{msgTag === 'important' ? ' \u2713' : ''}
                </button>
                <button onClick={() => toggleMsgTag(msg.id, 'pinned')} style={menuBtnStyle(msgTag === 'pinned' ? '#30D158' : '#8e8e93')}>
                  {'\u{1F4CC}'}{msgTag === 'pinned' ? ' \u2713' : ''}
                </button>
              </>
            )}
            {isMine && (
              <>
                <button onClick={() => startEdit(msg)} style={menuBtnStyle('#A9D6F8')}>{'\u270E'} Edit</button>
                <button onClick={() => confirmDelete(msg.id)} style={menuBtnStyle('#ff453a')}>{'\u2715'} Delete</button>
              </>
            )}
          </div>
        )}

        {/* Delete confirmation */}
        {isDelConfirm && (
          <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', padding: '5px 38px 3px', gap: 6, alignItems: 'center' }}
            onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: '0.7rem', color: '#ff453a', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delete?</span>
            <button onClick={executeDelete} style={{ background: '#ff453a', border: 'none', color: '#fff', borderRadius: 10, padding: '4px 14px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-label)', fontWeight: 700 }}>Yes</button>
            <button onClick={() => setDeleteConfirmId(null)} style={{ background: '#3a3a3c', border: 'none', color: '#8e8e93', borderRadius: 10, padding: '4px 12px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-label)' }}>Cancel</button>
          </div>
        )}

        {/* Reaction picker */}
        {reactionPicker === msg.id && (
          <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', padding: '0 38px 5px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 22, padding: '5px 9px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
              {REACTION_EMOJIS.map(r => {
                const iReacted = (localReactions[msg.id]?.[r] || []).includes(activeAs);
                return (
                  <button key={r} onClick={() => toggleReaction(msg.id, r)}
                    style={{
                      background: iReacted ? 'rgba(123,168,157,0.25)' : 'none',
                      border: iReacted ? '1px solid rgba(123,168,157,0.4)' : '1px solid transparent',
                      borderRadius: 12, cursor: 'pointer', fontSize: '1.1rem', padding: '3px 6px',
                      transition: 'all 0.15s',
                    }}>{r}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reply thread */}
        {replies.length > 0 && (
          <div style={{ paddingLeft: isMine ? 0 : 38, paddingRight: isMine ? 38 : 0, marginTop: 3 }}>
            <button onClick={e => { e.stopPropagation(); setOpenReplies(prev => { const s = new Set(prev); s.has(msg.id) ? s.delete(msg.id) : s.add(msg.id); return s; }); }}
              style={{ background: 'none', border: 'none', color: '#4a4a4e', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 0' }}>
              {openReplies.has(msg.id) ? '\u25BE' : '\u25B8'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
            {openReplies.has(msg.id) && (
              <div style={{ borderLeft: '2px solid #3a3a3c', paddingLeft: 10, marginLeft: 4, marginTop: 5 }}>
                {replies.map(r => {
                  const rp = PERSONS[r.author];
                  return (
                    <div key={r.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '0.65rem', color: rp?.color || '#8e8e93', fontFamily: 'var(--font-label)', fontWeight: 600, marginBottom: 2 }}>
                        {rp?.emoji} {rp?.name} <span style={{ color: '#4a4a4e' }}>{'\u00B7'} {r.ts}</span>
                      </div>
                      <div style={{ fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '0.82rem', color: '#ebebf5', background: '#28282a', borderRadius: 12, padding: '7px 11px', lineHeight: 1.4, display: 'inline-block' }}>{r.content}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render a group of messages ──
  function renderMsgGroup(msgs: AnyMsg[]) {
    return msgs.map((msg, idx) => {
      if (isSystemMsg(msg)) return renderSystemMsg(msg);
      const { prefix } = parseMsg(msg.content || '');
      return renderBubble(msg, idx, msgs);
    });
  }

  // ── Drawer styles ─────────────────────────────────────────────────────────
  const drawerBg = '#1c1c1e';

  return (
    <>
    {/* ── Floating bubble (collapsed) ── */}
    {!open && (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          right: 20,
          zIndex: 1000,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7BA89D 0%, #6A9A8F 100%)',
          border: '2.5px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 20px rgba(123,168,157,0.4), 0 2px 8px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(123,168,157,0.5), 0 3px 12px rgba(0,0,0,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(123,168,157,0.4), 0 2px 8px rgba(0,0,0,0.12)'; }}
        title="Open CR8W Chat"
      >
        <img src={cwLogoImg} alt="CR8W" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 20, height: 20, borderRadius: 10,
            background: '#E8C875', color: '#2C1810',
            fontSize: '0.6rem', fontWeight: 800,
            fontFamily: 'var(--font-label)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px',
            border: '2px solid #fff',
            boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
            animation: 'cwBubblePulse 2.5s ease-in-out infinite',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    )}

    {/* ── Expanded drawer (slides up from bottom-right) ── */}
    <div style={{
      position: 'fixed', bottom: 0, right: 0, zIndex: 1001,
      display: 'flex', flexDirection: 'column',
      transition: 'all 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
      height: open ? 'min(82vh, 740px)' : '0px',
      width: open ? 'min(100vw, 420px)' : '0px',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      background: drawerBg,
      borderRadius: '22px 0 0 0',
      boxShadow: open ? '0 -4px 40px rgba(0,0,0,0.5), -4px 0 20px rgba(0,0,0,0.15)' : 'none',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div
        onClick={() => setOpen(false)}
        style={{
          height: 52, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 16px', cursor: 'pointer',
          userSelect: 'none', borderBottom: '1px solid #2a2a2c',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={cwLogoImg} alt="CW" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>CR8W Chat</span>
          {unreadCount > 0 && (
            <span style={{
              background: '#7BA89D', color: '#fff', borderRadius: 10,
              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
              fontFamily: 'var(--font-label)',
            }}>
              {unreadCount} new
            </span>
          )}
          {focusMode && (
            <span style={{ background: '#FF9F0A22', color: '#FF9F0A', border: '1px solid #FF9F0A55', borderRadius: 10, fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', fontFamily: 'var(--font-label)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {'\u{1F3AF}'} Focus
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.65rem', color: '#636366', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Close</span>
          <span style={{ fontSize: '1.1rem', color: '#636366', lineHeight: 1 }}>{'\u2715'}</span>
        </div>
      </div>

      {/* ── Scroll area ── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '0 14px 10px',
        display: 'flex', flexDirection: 'column',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* Sticky toolbar: avatar + filter + focus */}
        <div style={{
          position: 'sticky', top: 0, background: drawerBg, zIndex: 2,
          borderBottom: '1px solid #2a2a2c', padding: '10px 0 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          {/* Left: avatar toggle + filter icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Active avatar (tap to reveal person picker) */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowPersonPicker(p => !p); }}
              style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: `${activeP?.color || '#7BA89D'}33`,
                border: `2px solid ${activeP?.color || '#7BA89D'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', cursor: 'pointer',
              }}
              title={`Chatting as ${activeP?.name} \u2014 tap to switch`}
            >
              {activeP?.emoji}
            </button>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: '#636366', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {activeP?.name}
            </span>

            {/* Filter icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowFilters(f => !f); }}
              style={{
                background: showFilters || filterMode !== 'all' ? 'rgba(123,168,157,0.15)' : '#2c2c2e',
                border: filterMode !== 'all' ? '1px solid rgba(123,168,157,0.4)' : '1px solid #3a3a3c',
                borderRadius: 10, padding: '5px 10px', cursor: 'pointer',
                fontSize: '0.62rem', fontWeight: 700, color: filterMode !== 'all' ? '#7BA89D' : '#636366',
                fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.3px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {'\u2630'} {filterMode !== 'all' ? filterMode : 'Filter'}
            </button>
          </div>

          {/* Right: focus toggle */}
          <div onClick={e => { e.stopPropagation(); setFocusMode(f => !f); }} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <span style={{ fontSize: '0.58rem', color: focusMode ? '#FF9F0A' : '#636366', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Focus</span>
            <div style={{ width: 34, height: 18, borderRadius: 9, background: focusMode ? '#FF9F0A' : '#3a3a3c', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: focusMode ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>

        {/* Person picker dropdown (only when toggled) */}
        {showPersonPicker && (
          <div style={{
            display: 'flex', gap: 6, padding: '8px 0', animation: 'msgFadeIn 0.2s ease',
          }}>
            {Object.entries(PERSONS).map(([k, p]) => (
              <button key={k} onClick={() => { onSetActiveAs(k); setShowPersonPicker(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20,
                border: activeAs === k ? `1.5px solid ${p.color}` : '1.5px solid #3a3a3c',
                background: activeAs === k ? `${p.color}22` : 'transparent',
                color: activeAs === k ? p.color : '#8e8e93',
                fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-label)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Filter row dropdown (only when toggled) */}
        {showFilters && (
          <div style={{ display: 'flex', gap: 5, padding: '6px 0 8px', animation: 'msgFadeIn 0.2s ease' }}>
            {([
              { mode: 'all' as FilterMode, label: 'All', icon: '', color: '#8e8e93' },
              { mode: 'pinned' as FilterMode, label: `Pinned${pinnedCount ? ` (${pinnedCount})` : ''}`, icon: '\u{1F4CC}', color: TAG_META.pinned.color },
              { mode: 'urgent' as FilterMode, label: `Urgent${urgentCount ? ` (${urgentCount})` : ''}`, icon: '\u{1F525}', color: TAG_META.urgent.color },
            ]).map(f => (
              <button key={f.mode} onClick={() => { setFilterMode(f.mode); setShowFilters(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '4px 10px', borderRadius: 14, flexShrink: 0,
                  border: filterMode === f.mode ? `1.5px solid ${f.color}` : '1px solid #3a3a3c',
                  background: filterMode === f.mode ? `${f.color}18` : 'transparent',
                  color: filterMode === f.mode ? f.color : '#636366',
                  fontSize: '0.62rem', fontWeight: 700,
                  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.4px',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {f.icon && <span style={{ fontSize: '0.72rem' }}>{f.icon}</span>} {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Digest (only when new items exist) ── */}
        {hasNewItems && !focusMode && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(123,168,157,0.10), rgba(184,169,212,0.07))',
            border: '1px solid rgba(123,168,157,0.22)',
            borderRadius: 16, padding: '10px 14px', margin: '8px 0',
          }}>
            <div style={{ fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '0.76rem', color: '#aaa', lineHeight: 1.8, display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7BA89D' }}>{'\u2600\uFE0F'} Digest</span>
              <span><span style={{ color: '#7BA89D', fontWeight: 600 }}>{unreadCount} unread</span></span>
              <span style={{ color: '#3a3a3c' }}>{'\u00B7'}</span>
              <span><span style={{ color: '#A9D6F8', fontWeight: 600 }}>{messages.filter(m => m.content?.includes('[FORUM]')).length || 0} well drops</span></span>
              {pinnedCount > 0 && (
                <><span style={{ color: '#3a3a3c' }}>{'\u00B7'}</span><span style={{ color: '#30D158', fontWeight: 600 }}>{pinnedCount} pinned</span></>
              )}
              {urgentCount > 0 && (
                <><span style={{ color: '#3a3a3c' }}>{'\u00B7'}</span><span style={{ color: '#FF453A', fontWeight: 600 }}>{urgentCount} urgent</span></>
              )}
            </div>
          </div>
        )}

        {/* ── Pinned float section ── */}
        {filterMode === 'all' && !focusMode && pinnedMsgs.length > 0 && (
          <div style={{ margin: '6px 0 8px' }}>
            <div style={{ background: 'rgba(48,209,88,0.05)', border: '1px solid rgba(48,209,88,0.15)', borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#30D158' }}>{'\u{1F4CC}'} Pinned ({pinnedMsgs.length})</span>
              </div>
              {pinnedMsgs.map(pm => {
                const pp = PERSONS[pm.author];
                const { body } = parseMsg(pm.content || '');
                return (
                  <div key={pm.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(48,209,88,0.08)' }}>
                    <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{pp?.emoji || '\u{1F464}'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.58rem', color: pp?.color || '#8e8e93', fontWeight: 600, marginBottom: 2 }}>
                        {pp?.name} {'\u00B7'} <span style={{ color: '#4a4a4e' }}>{formatMsgTime(pm.created_at)}</span>
                      </div>
                      <div style={{ fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '0.76rem', color: '#d0d0d4', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{body}</div>
                    </div>
                    <button onClick={() => toggleMsgTag(pm.id, 'pinned')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#30D158', padding: '2px', flexShrink: 0 }} title="Unpin">{'\u{1F4CC}'}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Focus mode banner ── */}
        {focusMode && (
          <div style={{
            textAlign: 'center', padding: '10px 0', marginBottom: 6,
            background: 'rgba(255,159,10,0.06)', borderRadius: 12,
          }}>
            <div style={{ color: '#FF9F0A', fontSize: '0.72rem', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
              {'\u{1F3AF}'} Focus Mode
            </div>
            <div style={{ color: '#636366', fontSize: '0.62rem', fontFamily: 'var(--font-label)', marginTop: 2 }}>
              Showing only urgent, pinned, reminders & @mentions
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#636366', fontSize: '0.82rem', padding: '30px 0', fontStyle: 'italic', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            the thread is quiet {'\u2014'} drop the first vibe {'\u{1F30A}'}
          </div>
        )}

        {/* ── "All caught up" state ── */}
        {messages.length > 0 && unreadCount === 0 && !focusMode && filterMode === 'all' && (
          <div style={{
            textAlign: 'center', padding: '16px 0', margin: '4px 0',
          }}>
            <div style={{ fontSize: '1.1rem', marginBottom: 3 }}>{'\u2728'}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: '#4a4a4e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All caught up
            </div>
          </div>
        )}

        {/* ── NEW (unread) section ── */}
        {focusFilteredNew.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
                color: '#7BA89D', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                New ({focusFilteredNew.length})
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(212,132,90,0.2)' }} />
            </div>
            {renderMsgGroup(focusFilteredNew)}
          </div>
        )}

        {/* ── EARLIER TODAY (read) section ── */}
        {focusFilteredEarlier.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 600,
                color: '#4a4a4e', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Earlier Today
              </span>
              <div style={{ flex: 1, height: 1, background: '#2a2a2c' }} />
            </div>
            {renderMsgGroup(focusFilteredEarlier)}
          </div>
        )}

        {/* ── OLDER messages (collapsed by default) ── */}
        {focusFilteredOlder.length > 0 && (
          <div>
            <div style={{ padding: '10px 0 6px', textAlign: 'center' }}>
              <button
                onClick={() => setShowOlderMsgs(v => !v)}
                style={{
                  background: '#2c2c2e', border: '1px solid #3a3a3c', borderRadius: 14,
                  padding: '5px 16px', cursor: 'pointer',
                  fontSize: '0.65rem', fontWeight: 700, color: '#636366',
                  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.4px',
                  transition: 'all 0.15s',
                }}
              >
                {showOlderMsgs ? 'Hide older' : `Show ${focusFilteredOlder.length} older`}
              </button>
            </div>
            {showOlderMsgs && (
              <div style={{ animation: 'msgFadeIn 0.35s ease' }}>
                {renderMsgGroup(focusFilteredOlder)}
              </div>
            )}
          </div>
        )}

        {/* ── Dismissed section ── */}
        {dismissedMsgs.length > 0 && (
          <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
            <button onClick={undismissAll} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.6rem', color: '#4a4a4e', fontFamily: 'var(--font-label)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {dismissedMsgs.length} dismissed {'\u00B7'} Restore all
            </button>
          </div>
        )}

        {/* Filter empty state */}
        {filterMode !== 'all' && allMsgs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#636366', fontSize: '0.78rem', padding: '24px 0', fontStyle: 'italic', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {filterMode === 'pinned' ? `no pinned messages yet ${'\u2014'} tap ${'\u{1F4CC}'} on any message` : `no urgent messages ${'\u2014'} that's a good thing ${'\u2728'}`}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #2a2a2c', background: drawerBg,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
      }}>

        {/* Type + Tag pills (only show when input focused) */}
        {inputFocused && (
          <div style={{ animation: 'msgFadeIn 0.2s ease' }}>
            <div style={{ display: 'flex', gap: 4, padding: '8px 14px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {MSG_TYPES.map(t => (
                <button key={t.id} onClick={() => setMsgType(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '3px 9px', borderRadius: 20, flexShrink: 0,
                    border: msgType === t.id ? 'none' : '1px solid #3a3a3c',
                    background: msgType === t.id ? '#7BA89D' : '#2c2c2e',
                    color: msgType === t.id ? '#fff' : '#8e8e93',
                    fontSize: '0.62rem', fontWeight: 700,
                    fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.4px',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, padding: '2px 14px 4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.56rem', color: '#4a4a4e', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Tag:</span>
              {(['urgent', 'important', 'pinned'] as MsgTag[]).map(tag => {
                if (!tag) return null;
                const t = TAG_META[tag];
                const isActive = activeTag === tag;
                return (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '2px 7px', borderRadius: 14, flexShrink: 0,
                      border: isActive ? `1.5px solid ${t.color}` : '1px solid #3a3a3c',
                      background: isActive ? t.bg : 'transparent',
                      color: isActive ? t.color : '#636366',
                      fontSize: '0.58rem', fontWeight: 700,
                      fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.3px',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '0.68rem' }}>{t.emoji}</span> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active type/tag indicator when not focused */}
        {!inputFocused && (msgType !== 'message' || activeTag) && (
          <div style={{ margin: '0 14px 4px', height: 1, background: activeTag ? `${TAG_META[activeTag]?.color || '#7BA89D'}44` : 'rgba(123,168,157,0.25)', borderRadius: 1 }} />
        )}

        {/* Reply preview */}
        {replyToId !== null && replyTarget && (
          <div style={{ margin: '0 14px 5px', background: '#28282a', borderRadius: 10, borderLeft: '2.5px solid #7BA89D', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#7BA89D', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>
                {'\u21A9'} Replying to {PERSONS[replyTarget.author]?.name || replyTarget.author}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#8e8e93', fontFamily: 'Montserrat, system-ui, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {parseMsg(replyTarget.content || '').body.slice(0, 50)}
              </div>
            </div>
            <button onClick={() => setReplyToId(null)} style={{ background: 'none', border: 'none', color: '#636366', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', flexShrink: 0 }}>{'\u00D7'}</button>
          </div>
        )}

        {/* Input row */}
        {/* Titration Dial: quiet mode indicator in chat */}
        {(() => {
          const dial = parseInt(localStorage.getItem('visibilityDial') || '1');
          if (dial === 0) return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 14px', margin: '0 14px 2px',
              background: 'rgba(139,181,196,0.1)',
              borderRadius: 8,
              fontFamily: 'Montserrat, system-ui, sans-serif',
              fontSize: '0.58rem', fontWeight: 600,
              color: '#8BB5C4', letterSpacing: '0.02em',
            }}>
              {'\uD83E\uDEE7'} quiet mode — messages will post as "a co-creator"
            </div>
          );
          return null;
        })()}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '5px 14px 8px' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 200)}
            placeholder={
              replyToId !== null
                ? `Reply to ${PERSONS[replyTarget?.author || '']?.name || 'thread'}\u2026`
                : activeTag
                  ? `${TAG_META[activeTag]?.emoji} ${TAG_META[activeTag]?.label} message as ${activeP?.name}\u2026`
                  : msgType !== 'message'
                    ? `${MSG_TYPES.find(t => t.id === msgType)?.icon} ${MSG_TYPES.find(t => t.id === msgType)?.label} as ${activeP?.name}\u2026`
                    : `Message as ${activeP?.name}\u2026`
            }
            style={{
              flex: 1, background: '#2c2c2e',
              border: `1.5px solid ${activeTag ? `${TAG_META[activeTag]?.color}66` : msgType !== 'message' ? '#7BA89D66' : '#3a3a3c'}`,
              borderRadius: 22, padding: '10px 16px', color: '#fff',
              fontSize: '0.88rem', fontFamily: 'Montserrat, system-ui, sans-serif',
              outline: 'none', lineHeight: 1.4, transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: text.trim() ? (activeTag ? TAG_META[activeTag]?.color || '#0A84FF' : msgType === 'message' ? '#0A84FF' : '#7BA89D') : '#2c2c2e',
              border: 'none', cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ color: '#fff', fontSize: '1rem' }}>{'\u2191'}</span>
          </button>
        </div>
      </div>

      {/* Inline CSS animation */}
      <style>{`
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cwUnreadPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes cwBubblePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
    </>
  );
}

// ── Shared styles ───────────────────────────────────────────────────────────
function menuBtnStyle(color: string): React.CSSProperties {
  return {
    background: '#3a3a3c', border: 'none', color, borderRadius: 10,
    padding: '4px 11px', fontSize: '0.7rem', cursor: 'pointer',
    fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em',
  };
}
