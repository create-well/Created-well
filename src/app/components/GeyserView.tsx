import React, { useState, useEffect } from 'react';
import {
  PERSONS, MILESTONES, GUEST_JOURNEY,
  getDaysToLaunch, formatDate, capitalize, formatTimestamp,
  PHASE_TAGS, PHASE_META, TASK_ROLES,
  type NoteItem,
} from './data';
import type { Task, Station, ForumPost, Announcement, CalendarEventKV } from './api';
import type { ForumReply as ApiForumReply, InviteCounts } from './api';
import * as api from './api';
import { HowWeFlowReference } from './HowWeFlowReference';

type GeyserTab = 'overview' | 'journey' | 'stations' | 'tasks' | 'forum';

// ── Forum: seeded sample threads ──────────────────────────────────────────────
type ForumReply = { id: number; author: string; content: string; ts: string };

const SEED_POSTS: ForumPost[] = [];

const SEED_REPLIES: Record<number, ForumReply[]> = {};

interface GeyserViewProps {
  onNavigate: (view: string) => void;
  actionItems: Task[];
  stations: Station[];
  announcements: Announcement[];
  wellNotes: NoteItem[];
  forum: ForumPost[];
  forumReplies?: ApiForumReply[];
  defaultTab?: GeyserTab;
  onAddTask: () => void;
  onUpdateTaskStatus: (id: number, status: string) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onDeleteTask: (id: number) => void;
  onDismissAnnouncement: (id: number) => void;
  onAddAnnouncement: () => void;
  onAddNote: (content: string, author: string) => void;
  onAddForumPost: (post: Omit<ForumPost, 'id' | 'created_at'>) => void;
  onUpdateForumPost?: (id: number, updates: Partial<ForumPost>) => void;
  onDeleteForumPost: (id: number) => void;
  onAddForumReply?: (postId: number, reply: { author: string; content: string }) => void;
  onDeleteForumReply?: (replyId: number) => void;
  onUpdateStationStatus: (id: number, status: string) => void;
  onUpdateStationOwner: (id: number, owner: string) => void;
  onUpdateStationField: (id: number, updates: Partial<Station>) => void;
  onAddStation: (s: Omit<Station, 'id' | 'created_at'>) => void;
  onDeleteStation: (id: number) => void;
}

const statusLabels: Record<string, string> = { in_progress: 'In Progress', planning: 'Planning', done: 'Done' };
const statusClasses: Record<string, string> = { in_progress: 'journey-status-active', planning: 'journey-status-planning', done: 'journey-status-done' };
const statusColors: Record<string, { bg: string; color: string; dot: string }> = {
  'Confirmed': { bg: '#E0F0E0', color: '#3A7A3A', dot: '#6BAF6B' },
  'Planning': { bg: '#FFF3D6', color: '#8A6A20', dot: '#D4A771' },
  'Exploring': { bg: '#EAF4FC', color: '#3A6A8A', dot: '#A9D6F8' },
  'TBD': { bg: '#F0F0F0', color: '#666', dot: '#A89888' }
};

// Due-soon / overdue helper
function getDueClass(due_date?: string, status?: string): string {
  if (!due_date || status === 'done') return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + 'T00:00:00');
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'due-soon';
  return '';
}

// Inline editable text
function InlineEdit({ value, onSave, className, style, multiline }: {
  value: string; onSave: (v: string) => void;
  className?: string; style?: React.CSSProperties; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft.trim() && draft !== value) onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    const props = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      },
      autoFocus: true,
      style: { width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--clay-velour)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 'inherit', ...style },
    };
    return multiline
      ? <textarea {...props} rows={3} style={{ ...props.style, resize: 'vertical' }} />
      : <input {...props} />;
  }

  return (
    <span
      className={className}
      style={{ cursor: 'text', ...style }}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

export function GeyserView({
  onNavigate, actionItems, stations, announcements, wellNotes,
  forum, forumReplies, defaultTab, onAddTask, onUpdateTaskStatus, onUpdateTask, onDeleteTask,
  onDismissAnnouncement, onAddAnnouncement, onAddNote,
  onAddForumPost, onUpdateForumPost, onDeleteForumPost,
  onAddForumReply, onDeleteForumReply,
  onUpdateStationStatus, onUpdateStationOwner, onUpdateStationField,
  onAddStation, onDeleteStation,
}: GeyserViewProps) {
  const [activeTab, setActiveTab] = useState<GeyserTab>(defaultTab || 'overview');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [forumAuthor, setForumAuthor] = useState<string>('sunshine');
  const [forumDraft, setForumDraft] = useState('');
  const [forumTag, setForumTag] = useState<string>('update');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [showAddStation, setShowAddStation] = useState(false);
  const [newStation, setNewStation] = useState({ emoji: '🎨', name: '', description: '', status: 'Exploring', owner: 'monny' });
  const [noteInput, setNoteInput] = useState('');
  const [editingForumId, setEditingForumId] = useState<number | null>(null);
  const [editForumDraft, setEditForumDraft] = useState('');

  // Invite counts from Google Sheet (via KV)
  const [inviteCounts, setInviteCounts] = useState<InviteCounts>({ confirmed: 0, pending: 0, declined: 0, maybe: 0, total: 0 });
  const [inviteLoaded, setInviteLoaded] = useState(false);

  useEffect(() => {
    api.getInviteCounts()
      .then(data => { setInviteCounts(data); setInviteLoaded(true); })
      .catch(e => { if (!(e instanceof TypeError)) console.error(e); setInviteLoaded(true); });
  }, []);

  // Calendar events from KV (synced from shared Google Calendar)
  const [kvCalEvents, setKvCalEvents] = useState<CalendarEventKV[]>([]);
  const [kvCalLoaded, setKvCalLoaded] = useState(false);
  useEffect(() => {
    api.getCalendarEvents()
      .then(data => { setKvCalEvents(data || []); setKvCalLoaded(true); })
      .catch(e => { if (!(e instanceof TypeError)) console.error(e); setKvCalLoaded(true); });
  }, []);

  const daysToLaunch = getDaysToLaunch();
  const stationList = stations;
  const confirmedStations = stationList.filter(s => s.status === 'Confirmed').length;
  const highPriority = actionItems.filter(t => t.priority === 'high' && t.status !== 'done').length;

  const allPosts = [...SEED_POSTS, ...forum].sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  // Merge seed replies with API replies
  function getRepliesForPost(postId: number): (ForumReply | ApiForumReply)[] {
    const seed = SEED_REPLIES[postId] || [];
    const api = (forumReplies || []).filter(r => r.postId === postId);
    return [...seed, ...api];
  }

  const tabs: { key: GeyserTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'journey', label: 'Journey', icon: '🗺️' },
    { key: 'stations', label: 'Stations', icon: '🏕️' },
    { key: 'tasks', label: 'Moves', icon: '✅' },
    { key: 'forum', label: 'Forum', icon: '💬' },
  ];

  // ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
  function renderOverview() {
    const doneCount = MILESTONES.filter(m => m.done).length;
    return (
      <div className="geyser-tab-content">
        {announcements.length > 0 && (
          <div className="geyser-announcements-banner">
            <div className="gab-header">
              <span className="gab-icon">🔥</span>
              <span className="gab-title">Top Priority Right Now</span>
              <button className="gab-add-btn" onClick={onAddAnnouncement}>+</button>
            </div>
            <div className="gab-list">
              {announcements.slice(0, 3).map(a => (
                <div key={a.id} className="gab-item">
                  <span className={`gcc-priority-badge ${a.priority}`}>{a.priority.toUpperCase()}</span>
                  <span className="gab-text">{a.text}</span>
                  <button className="gab-dismiss" onClick={() => onDismissAnnouncement(a.id)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="geyser-big-countdown">
          <div className="gbc-num">{daysToLaunch}</div>
          <div className="gbc-label">days until<br />April 15, 2026</div>
        </div>

        {/* Key Dates mini-timeline */}
        <div className="geyser-key-dates card">
          <div className="geyser-key-dates-header">
            <h3 className="geyser-section-title" style={{ marginBottom: 0 }}>📅 Key Dates</h3>
            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank" rel="noopener noreferrer"
              className="hub-gcal-open"
            >Google Calendar ↗</a>
          </div>
          {(() => {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            // Deduplicate by canonical ID (strip leading 'kv-' prefix if present)
            const seen = new Set<string>();
            const deduped = kvCalEvents.filter(ev => {
              const canonical = ev.id.replace(/^kv-/, '');
              if (seen.has(canonical)) return false;
              seen.add(canonical);
              return true;
            });
            const upcoming = deduped
              .filter(ev => new Date(ev.start) >= now)
              .sort((a, b) => a.start.localeCompare(b.start))
              .slice(0, 6);
            if (!kvCalLoaded) {
              return (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
                  loading calendar…
                </div>
              );
            }
            if (upcoming.length === 0) {
              return (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  no upcoming events — add events to the shared Google Calendar to see them here
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {upcoming.map(ev => {
                  const startDate = new Date(ev.start);
                  const isToday = startDate.toDateString() === new Date().toDateString();
                  const dateLabel = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const timeLabel = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                  return (
                    <div key={ev.id.replace(/^kv-/, '')} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, background: isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)' : 'transparent',
                      border: isToday ? '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.2)' : '1px solid transparent',
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isToday ? 'var(--cr8w-primary)' : 'var(--camel-sun, #D4A771)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.82rem', fontWeight: 600,
                          color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{ev.title}</div>
                        <div style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted)',
                          display: 'flex', gap: 6, alignItems: 'center',
                        }}>
                          <span>{dateLabel}</span>
                          <span style={{ opacity: 0.3 }}>·</span>
                          <span>{timeLabel}</span>
                          {ev.location && <><span style={{ opacity: 0.3 }}>·</span><span>{ev.location}</span></>}
                        </div>
                      </div>
                      {isToday && (
                        <span style={{
                          fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                          color: '#fff', background: 'var(--cr8w-primary)', borderRadius: 6, padding: '2px 6px',
                          textTransform: 'uppercase', letterSpacing: '0.03em',
                        }}>Today</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Monthly Rhythm Calendar (feature 2) ───────────────────────── */}
        <div className="geyser-section">
          <h3 className="geyser-section-title">🥁 Monthly Rhythm</h3>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.77rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5, fontStyle: 'italic' }}>
              One Cohoe session sets the whole month. We batch so we can flow the rest.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { weeks: 'Wk 1–2', label: 'Open Studio / Drop-in',    icon: '🎨', color: '#7BA89D', note: 'Recurring open door — community arrival, low-barrier entry' },
                { weeks: 'Wk 3',   label: 'Workshop',                  icon: '🔧', color: '#D4A771', note: 'Every 3rd month this slot becomes a full Geyser event' },
                { weeks: 'Wk 4',   label: 'Reflect + Batch in Cohoe',  icon: '🌿', color: '#B8A9D4', note: 'Team reflection · Cohoe plans and batches the next month together' },
              ].map(row => (
                <div key={row.weeks} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 12px', borderRadius: 8, background: `${row.color}12`, border: `1px solid ${row.color}35` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, paddingTop: 2 }}>
                    <span style={{ fontSize: '1.1rem' }}>{row.icon}</span>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.54rem', fontWeight: 700, color: row.color, letterSpacing: '0.04em', marginTop: 2 }}>{row.weeks}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.8rem', fontWeight: 700, color: row.color, marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.71rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{row.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 11, padding: '7px 12px', borderRadius: 6, background: 'rgba(194,91,56,0.06)', border: '1px solid rgba(194,91,56,0.14)', fontFamily: 'var(--font-label)', fontSize: '0.67rem', color: '#C25B38', lineHeight: 1.5 }}>
              🗓 <strong>Cohoe default:</strong> Month-end batch session — Google Calendar auto-populates this cadence when connected.
            </div>
          </div>
        </div>

        <div className="geyser-stats-grid">
          <a href="https://docs.google.com/spreadsheets/d/1yTemDgbFQG3SdkD8uy-0v1Ogc0XIyS2sWj-iR-xLToc/edit" target="_blank" rel="noopener noreferrer" className="geyser-stat-card">
            <div className="geyser-stat-num">{inviteLoaded ? inviteCounts.confirmed : '—'}</div>
            <div className="geyser-stat-label">Confirmed<br />Guests</div>
            <div className="geyser-stat-sub">{inviteLoaded && inviteCounts.total > 0 ? `of ${inviteCounts.total} invited` : 'synced from invite sheet'}</div>
            <span className="geyser-stat-action">Open Sheet ↗</span>
          </a>
          <a href="https://drive.google.com/drive/folders/1d9OyYZusS0yyYsfwtjLkz1ss0KYPzl5a" target="_blank" rel="noopener noreferrer" className="geyser-stat-card">
            <div className="geyser-stat-num">—</div>
            <div className="geyser-stat-label">Sponsorship<br />Raised</div>
            <div className="geyser-stat-sub">tracking in progress</div>
            <span className="geyser-stat-action">CW Drive ↗</span>
          </a>
          <button className="geyser-stat-card" onClick={() => setActiveTab('stations')} style={{ textAlign: 'center', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
            <div className="geyser-stat-num">{confirmedStations}</div>
            <div className="geyser-stat-label">Stations<br />Confirmed</div>
            <div className="geyser-stat-sub">of {stationList.length} total</div>
            <span className="geyser-stat-action">View Stations →</span>
          </button>
          <button className="geyser-stat-card urgent" onClick={() => setActiveTab('tasks')} style={{ textAlign: 'center', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
            <div className="geyser-stat-num">{highPriority}</div>
            <div className="geyser-stat-label">High Priority<br />Open Moves</div>
            <div className="geyser-stat-sub">need energy</div>
            <span className="geyser-stat-action">View Moves →</span>
          </button>
        </div>

        {MILESTONES.length > 0 && (
        <div className="geyser-section">
          <h3 className="geyser-section-title">🚀 Launch Milestones</h3>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doneCount} of {MILESTONES.length} complete</span>
              <span style={{ color: 'var(--text-muted)' }}>{Math.round(doneCount / MILESTONES.length * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--sandstone)', overflow: 'hidden' }}>
              <div style={{ width: `${(doneCount / MILESTONES.length) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--cr8w-primary)', transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {MILESTONES.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.9rem' }}>{m.done ? '✅' : '⬜'}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: m.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: m.done ? 'line-through' : 'none' }}>
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Invite Pipeline */}
        <div className="geyser-section">
          <h3 className="geyser-section-title">📊 Invite Pipeline</h3>
          <div className="card">
            {inviteLoaded ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6BAF6B' }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: '#3A7A3A' }}>
                    {inviteCounts.confirmed} Confirmed
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4A771' }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: '#8A6A20' }}>
                    {inviteCounts.pending} Pending
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A89888' }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: '#666' }}>
                    {inviteCounts.declined} Declined
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A9D6F8' }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: '#3A6A8A' }}>
                    {inviteCounts.maybe} Maybe
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ccc' }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: '#666' }}>
                    {inviteCounts.total} Total
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                invite tracking will populate here as RSVPs come in
              </div>
            )}
          </div>
        </div>

        {/* Team Vibes */}
        <div className="geyser-section">
          <h3 className="geyser-section-title">👥 Team</h3>
          <div className="geyser-team-grid">
            {Object.entries(PERSONS).map(([key, person]) => {
              const personTasks = actionItems.filter(t => t.person === key && t.status !== 'done');
              return (
                <button key={key} className="geyser-team-card" onClick={() => onNavigate(key)} style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: person.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                      {person.emoji}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: person.color }}>{person.name}</div>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{person.role.split('·')[0].trim()}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {personTasks.length} open move{personTasks.length !== 1 ? 's' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Well Notes */}
        <div className="geyser-section">
          <h3 className="geyser-section-title">📝 Notes from the Well</h3>
          <div className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="share a thought, reflection, or intention…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && noteInput.trim()) {
                    onAddNote(noteInput.trim(), 'monny');
                    setNoteInput('');
                  }
                }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', background: 'transparent', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => { if (noteInput.trim()) { onAddNote(noteInput.trim(), 'monny'); setNoteInput(''); } }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Drop
              </button>
            </div>
            {wellNotes.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontStyle: 'italic', padding: '16px 0' }}>
                no notes yet — drop one in to start the flow
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wellNotes.slice(0, 6).map((n, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.05)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {n.content}
                    {n.created_at && <span style={{ display: 'block', marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatTimestamp(n.created_at)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* ── How We Flow Reference (collapsible, feature 5) ───────────── */}
        <HowWeFlowReference />
      </div>
    );
  }

  // ── JOURNEY TAB ───────────────────────────────────────────────────────────────
  function renderJourney() {
    if (GUEST_JOURNEY.length === 0) {
      return (
        <div className="geyser-tab-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗺️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 6 }}>Guest Journey</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              journey stages will appear here as they're configured
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="geyser-tab-content">
        <div className="geyser-section">
          <h3 className="geyser-section-title">🗺️ Guest Journey Map</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {GUEST_JOURNEY.map((stage: any, i: number) => (
              <div key={i} className="card" style={{ borderLeft: `3px solid ${stage.color || 'var(--cr8w-primary)'}` }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: stage.color || 'var(--cr8w-primary)', marginBottom: 6 }}>
                  {stage.emoji} {stage.name}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {stage.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── STATIONS TAB ──────────────────────────────────────────────────────────────
  function renderStations() {
    const grouped = Object.entries(statusColors).map(([status, colors]) => ({
      status, colors,
      items: stationList.filter(s => s.status === status),
    }));

    return (
      <div className="geyser-tab-content">
        {/* Station summary */}
        <div className="geyser-station-summary">
          {Object.entries(statusColors).map(([status, colors]) => {
            const count = stationList.filter(s => s.status === status).length;
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot }} />
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: colors.color }}>
                  {count} {status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Add station button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setShowAddStation(!showAddStation)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            {showAddStation ? '✕ Cancel' : '+ Add Station'}
          </button>
        </div>

        {showAddStation && (
          <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newStation.emoji} onChange={e => setNewStation({ ...newStation, emoji: e.target.value })} placeholder="Emoji" style={{ width: 50, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', textAlign: 'center', fontSize: '1.2rem', background: 'transparent' }} />
              <input value={newStation.name} onChange={e => setNewStation({ ...newStation, name: e.target.value })} placeholder="Station name" style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'transparent', color: 'var(--text-primary)' }} />
            </div>
            <input value={newStation.description} onChange={e => setNewStation({ ...newStation, description: e.target.value })} placeholder="Description" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'transparent', color: 'var(--text-primary)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newStation.status} onChange={e => setNewStation({ ...newStation, status: e.target.value })} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', background: 'transparent', color: 'var(--text-primary)' }}>
                {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={newStation.owner} onChange={e => setNewStation({ ...newStation, owner: e.target.value })} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', background: 'transparent', color: 'var(--text-primary)' }}>
                {Object.keys(PERSONS).map(k => <option key={k} value={k}>{capitalize(k)}</option>)}
              </select>
            </div>
            <button
              onClick={() => {
                if (newStation.name.trim()) {
                  onAddStation({ emoji: newStation.emoji || '🎨', name: newStation.name.trim(), description: newStation.description.trim(), status: newStation.status, owner: newStation.owner });
                  setNewStation({ emoji: '🎨', name: '', description: '', status: 'Exploring', owner: 'monny' });
                  setShowAddStation(false);
                }
              }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              Add Station
            </button>
          </div>
        )}

        {stationList.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏕️</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              no stations yet — add one above to get started
            </div>
          </div>
        ) : (
          <div className="geyser-stations-grid">
            {stationList.map(s => {
              const sc = statusColors[s.status] || statusColors['TBD'];
              const owner = PERSONS[s.owner];
              return (
                <div key={s.id} className="geyser-station-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.4rem' }}>{s.emoji}</span>
                      <InlineEdit
                        value={s.name}
                        onSave={v => onUpdateStationField(s.id, { name: v })}
                        style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}
                      />
                    </div>
                    <button onClick={() => onDeleteStation(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', padding: 4 }}>🗑</button>
                  </div>
                  <InlineEdit
                    value={s.description}
                    onSave={v => onUpdateStationField(s.id, { description: v })}
                    multiline
                    style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'block', marginBottom: 10 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select
                      value={s.status}
                      onChange={e => onUpdateStationStatus(s.id, e.target.value)}
                      style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: sc.bg, color: sc.color, fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {Object.keys(statusColors).map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <select
                      value={s.owner}
                      onChange={e => onUpdateStationOwner(s.id, e.target.value)}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-label)', fontSize: '0.68rem', background: 'transparent', color: owner?.color || 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      {Object.keys(PERSONS).map(k => <option key={k} value={k}>{capitalize(k)}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── TASKS TAB ─────────────────────────────────────────────────────────────────
  function renderTasks() {
    const filtered = taskFilter === 'all' ? actionItems : actionItems.filter(t => t.person === taskFilter);
    const sorted = [...filtered].sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const statusOrder: Record<string, number> = { blocked: 0, todo: 1, in_progress: 2, done: 3 };
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return statusOrder[a.status] - statusOrder[b.status];
    });

    return (
      <div className="geyser-tab-content">
        {/* Prominent terracotta Add Task CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="geyser-section-title" style={{ marginBottom: 0 }}>✅ Next Moves</h3>
          <button
            onClick={onAddTask}
            style={{
              padding: '10px 22px', borderRadius: 10, border: 'none',
              background: '#C25B38', color: '#fff',
              fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 2px 10px rgba(194,91,56,0.28)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#A84A2A'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#C25B38'; }}
          >
            + Drop a Move
          </button>
        </div>

        {/* Role-aware filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setTaskFilter('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              border: `1.5px solid ${taskFilter === 'all' ? '#C25B38' : 'var(--border-soft)'}`,
              background: taskFilter === 'all' ? 'rgba(194,91,56,0.09)' : 'transparent',
              color: taskFilter === 'all' ? '#C25B38' : 'var(--text-muted)',
              fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
            }}
          >All Roles</button>
          {Object.entries(TASK_ROLES).map(([key, role]) => {
            const active = taskFilter === key;
            const openCount = actionItems.filter(t => t.person === key && t.status !== 'done').length;
            return (
              <button
                key={key}
                onClick={() => setTaskFilter(key)}
                title={`${role.short} — ${role.sub}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '7px 13px', borderRadius: 10, cursor: 'pointer', minWidth: 90,
                  border: `1.5px solid ${active ? role.color : 'var(--border-soft)'}`,
                  background: active ? `${role.color}20` : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: '0.8rem' }}>{role.emoji}</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.74rem', fontWeight: 700, color: active ? role.color : 'var(--text-primary)' }}>
                    {role.name}
                  </span>
                  {openCount > 0 && (
                    <span style={{ padding: '0 5px', borderRadius: 8, lineHeight: '16px', fontSize: '0.58rem', fontWeight: 700, background: active ? role.color : 'var(--sandstone)', color: active ? '#fff' : 'var(--text-muted)' }}>
                      {openCount}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.57rem', color: 'var(--text-muted)', marginTop: 1 }}>{role.short}</span>
              </button>
            );
          })}
        </div>

        {sorted.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>✨</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {taskFilter === 'all' ? 'the stage is set — what\u2019s your first move?' : `no moves for ${TASK_ROLES[taskFilter]?.name || capitalize(taskFilter)}`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(task => {
              const role = TASK_ROLES[task.person];
              const dueClass = getDueClass(task.due_date, task.status);
              return (
                <div key={task.id} className={`card ${dueClass}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  <div className="geyser-task-person-dot" style={{ background: role?.color || '#A89888' }} title={role ? `${role.name} — ${role.sub}` : task.person}>
                    {role?.emoji || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <InlineEdit
                      value={task.title}
                      onSave={v => onUpdateTask(task.id, { title: v })}
                      style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`gcc-priority-badge ${task.priority}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{task.priority}</span>
                      {task.due_date && <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: dueClass === 'overdue' ? '#D45050' : 'var(--text-muted)' }}>Due {formatDate(task.due_date)}</span>}
                      {task.category && <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: 'var(--text-muted)', background: 'var(--sandstone)', padding: '1px 6px', borderRadius: 4 }}>{task.category}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={task.status}
                      onChange={e => onUpdateTaskStatus(task.id, e.target.value)}
                      style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-label)', fontSize: '0.68rem', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                      <option value="blocked">Blocked</option>
                    </select>
                    <button onClick={() => onDeleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)', padding: 4 }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── FORUM TAB ─────────────────────────────────────────────────────────────────
  function renderForum() {
    return (
      <div className="geyser-tab-content">
        <h3 className="geyser-section-title">💬 Co-Creator Forum</h3>

        {/* Author select */}
        <div className="geyser-forum-author-select">
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Posting as:</span>
          {Object.entries(PERSONS).map(([key, person]) => (
            <button key={key} onClick={() => setForumAuthor(key)} style={{ width: 30, height: 30, borderRadius: '50%', border: forumAuthor === key ? `2px solid ${person.color}` : '2px solid transparent', background: person.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s' }}>
              {person.emoji}
            </button>
          ))}
        </div>

        {/* Compose */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={forumTag} onChange={e => setForumTag(e.target.value)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-label)', fontSize: '0.72rem', background: 'var(--bg-elevated,#FAFAF8)', color: 'var(--text-secondary)' }}>
              <optgroup label="Thread Type">
                <option value="update">Update</option>
                <option value="decision">Decision</option>
                <option value="reminder">Reminder</option>
                <option value="idea">Idea</option>
                <option value="question">Question</option>
              </optgroup>
              <optgroup label="── Event Phase ──">
                {(PHASE_TAGS as readonly string[]).map(p => {
                  const m = PHASE_META[p];
                  return <option key={p} value={p}>{m.emoji} {m.label}</option>;
                })}
              </optgroup>
            </select>
            {PHASE_META[forumTag] && (
              <div style={{ flex: 1, padding: '4px 10px', borderRadius: 6, background: `${PHASE_META[forumTag].color}18`, border: `1px solid ${PHASE_META[forumTag].color}40`, fontFamily: 'var(--font-body)', fontSize: '0.69rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {PHASE_META[forumTag].desc}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={forumDraft}
              onChange={e => setForumDraft(e.target.value)}
              placeholder="start a new thread…"
              rows={2}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', background: 'transparent', color: 'var(--text-primary)', resize: 'vertical' }}
            />
            <button
              onClick={() => {
                if (forumDraft.trim()) {
                  onAddForumPost({ author: forumAuthor, content: forumDraft.trim(), tag: forumTag });
                  setForumDraft('');
                }
              }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              Post
            </button>
          </div>
        </div>

        {/* Threads */}
        {allPosts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>💬</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              no threads yet — start a conversation above
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {allPosts.map(post => {
              const author = PERSONS[post.author];
              const replies = getRepliesForPost(post.id);
              const isSeed = post.id >= 9000;
              return (
                <div key={post.id} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: author?.color || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                      {author?.emoji || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: author?.color || 'var(--text-primary)' }}>{capitalize(post.author)}</span>
                        {post.tag && (() => {
                          const pm = PHASE_META[post.tag];
                          return (
                            <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, fontFamily: 'var(--font-label)', fontWeight: 600, background: pm ? `${pm.color}22` : 'var(--sandstone)', color: pm ? pm.color : 'var(--text-secondary)', border: pm ? `1px solid ${pm.color}50` : 'none' }}>
                              {pm ? `${pm.emoji} ${pm.label}` : post.tag}
                            </span>
                          );
                        })()}
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatTimestamp(post.created_at)}</span>
                      </div>
                      {editingForumId === post.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <textarea value={editForumDraft} onChange={e => setEditForumDraft(e.target.value)} rows={2} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', background: 'transparent', color: 'var(--text-primary)', resize: 'vertical' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button onClick={() => { onUpdateForumPost?.(post.id, { content: editForumDraft.trim() }); setEditingForumId(null); }} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontSize: '0.68rem', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingForumId(null)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-soft)', background: 'transparent', fontSize: '0.68rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {post.content}
                        </div>
                      )}
                    </div>
                    {!isSeed && editingForumId !== post.id && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditingForumId(post.id); setEditForumDraft(post.content); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--text-muted)' }}>✏️</button>
                        <button onClick={() => onDeleteForumPost(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--text-muted)' }}>🗑</button>
                      </div>
                    )}
                  </div>

                  {/* Replies */}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: 42, borderLeft: '2px solid var(--border-soft)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {replies.map((reply: any) => {
                        const replyAuthor = PERSONS[reply.author];
                        const isApi = 'postId' in reply;
                        return (
                          <div key={reply.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: replyAuthor?.color || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0 }}>
                              {replyAuthor?.emoji || '?'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: replyAuthor?.color || 'var(--text-secondary)' }}>{capitalize(reply.author)}</span>
                              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 6 }}>{'ts' in reply ? reply.ts : formatTimestamp(reply.created_at)}</span>
                              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
                                {reply.content}
                              </div>
                            </div>
                            {isApi && (
                              <button onClick={() => onDeleteForumReply?.(reply.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', color: 'var(--text-muted)' }}>🗑</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply compose */}
                  <div style={{ marginLeft: 42, marginTop: 8, display: 'flex', gap: 6 }}>
                    <input
                      value={replyDrafts[post.id] || ''}
                      onChange={e => setReplyDrafts({ ...replyDrafts, [post.id]: e.target.value })}
                      placeholder="reply…"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (replyDrafts[post.id] || '').trim()) {
                          onAddForumReply?.(post.id, { author: forumAuthor, content: replyDrafts[post.id].trim() });
                          setReplyDrafts({ ...replyDrafts, [post.id]: '' });
                        }
                      }}
                      style={{ flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', fontFamily: 'var(--font-body)', fontSize: '0.78rem', background: 'transparent', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={() => {
                        if ((replyDrafts[post.id] || '').trim()) {
                          onAddForumReply?.(post.id, { author: forumAuthor, content: replyDrafts[post.id].trim() });
                          setReplyDrafts({ ...replyDrafts, [post.id]: '' });
                        }
                      }}
                      style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--cr8w-primary)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="geyser-command-center" style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 60px' }}>
      <div className="geyser-header">
        <div className="geyser-header-title">Geyser</div>
        <div className="geyser-header-subtitle">the launchpad</div>
        <div className="geyser-header-info">
          <div className="geyser-header-countdown">
            <span className="geyser-countdown-num">{daysToLaunch}</span>
            <span className="geyser-countdown-label">days til we go live</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="geyser-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`geyser-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'journey' && renderJourney()}
      {activeTab === 'stations' && renderStations()}
      {activeTab === 'tasks' && renderTasks()}
      {activeTab === 'forum' && renderForum()}
    </div>
  );
}