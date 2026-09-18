import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, MapPin, Clock, Users, ChevronDown, ChevronUp, Lock, Unlock, Edit3, ExternalLink, Archive, Calendar } from 'lucide-react';
import { PERSONS, capitalize, formatTimestamp } from './data';
import type { CoFlowDate, CoFlowCheckin, CalendarEventKV } from './api';
import * as api from './api';

type D8Tab = 'upcoming' | 'checkin' | 'archive' | 'agenda';

const LOCATION_SUGGESTIONS = [
  'Taverna Costera',
  "Sunshine's Place",
  "Monny's Studio",
  'Coffee + Commune',
  'The Park (outdoor)',
  'Virtual / Zoom',
];

const TIME_OPTIONS = [
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM',
];

const MOOD_OPTIONS: { key: string; emoji: string; label: string; color: string }[] = [
  { key: 'fire', emoji: '\u{1F525}', label: 'Energized', color: '#E85D3A' },
  { key: 'sun', emoji: '\u2600\uFE0F', label: 'Good', color: '#D4A771' },
  { key: 'cloud', emoji: '\u2601\uFE0F', label: 'Meh', color: '#8A9BB0' },
  { key: 'rain', emoji: '\u{1F327}\uFE0F', label: 'Low', color: '#6888A5' },
  { key: 'storm', emoji: '\u26C8\uFE0F', label: 'Rough', color: '#7A5C6B' },
];

const PERSON_KEYS = ['sunshine', 'monny', 'bingle'] as const;

interface CoFlowD8sViewProps {
  coflowDates: CoFlowDate[];
  coflowCheckins: CoFlowCheckin[];
  onAddCoFlowDate: (d: Omit<CoFlowDate, 'id' | 'created_at'>) => void;
  onUpdateCoFlowDate: (id: number, updates: Partial<CoFlowDate>) => void;
  onDeleteCoFlowDate: (id: number) => void;
  onAddCoFlowCheckin: (c: Omit<CoFlowCheckin, 'id' | 'created_at'>) => void;
  onDeleteCoFlowCheckin: (id: number) => void;
}

function getNextFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatD8(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatD8Short(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayOfWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getCountdown(dateStr: string): { label: string; urgent: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: 'TODAY!', urgent: true };
  if (diffDays === 1) return { label: 'TOMORROW', urgent: true };
  if (diffDays < 0) return { label: `${Math.abs(diffDays)} days ago`, urgent: false };
  return { label: `${diffDays} days away`, urgent: diffDays <= 3 };
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') >= today;
}

function getTimeDisplay(d8: CoFlowDate): string {
  if (d8.startTime && d8.endTime) return `${d8.startTime} \u2013 ${d8.endTime}`;
  return d8.timeRange || 'TBD';
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 'var(--cr-radius-md)',
  padding: 20, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '0.68rem', textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'block',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 'var(--cr-radius-sm)',
  border: '1.5px solid var(--border-soft)', background: 'var(--bg-elevated)',
  fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)',
};
const btnPrimary: React.CSSProperties = {
  padding: '10px 24px', borderRadius: 'var(--cr-radius-md)',
  background: 'var(--cr8w-primary)', color: '#fff',
  fontFamily: 'var(--font-label)', fontSize: '0.82rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', border: 'none',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--cr-radius-md)',
  background: 'var(--sandstone)', color: 'var(--text-secondary)',
  fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.3px', cursor: 'pointer',
  border: '1px solid var(--border-soft)',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function CoFlowD8sView({
  coflowDates, coflowCheckins,
  onAddCoFlowDate, onUpdateCoFlowDate, onDeleteCoFlowDate,
  onAddCoFlowCheckin, onDeleteCoFlowCheckin,
}: CoFlowD8sViewProps) {
  const [tab, setTab] = useState<D8Tab>('upcoming');
  const [showCreateD8, setShowCreateD8] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState<number | null>(null);
  const [editingD8, setEditingD8] = useState(false);

  // Calendar events from KV (shared Google Calendar sync)
  const [kvCalEvents, setKvCalEvents] = useState<CalendarEventKV[]>([]);
  useEffect(() => {
    api.getCalendarEvents()
      .then(data => setKvCalEvents(data || []))
      .catch(e => console.error('Failed to fetch calendar events in PlayD8s:', e));
  }, []);

  const upcomingD8s = useMemo(() =>
    coflowDates.filter(d => (d.status === 'upcoming' || d.status === 'active') && isUpcoming(d.date))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [coflowDates]
  );
  const archivedD8s = useMemo(() =>
    coflowDates.filter(d => d.status === 'archived').sort((a, b) => b.date.localeCompare(a.date)),
    [coflowDates]
  );

  const nextD8 = upcomingD8s[0];

  // Wednesday check-in stats
  const isWednesday = new Date().getDay() === 3;
  const todayStr = new Date().toISOString().split('T')[0];
  const thisWeekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const weekCheckins = coflowCheckins.filter(c => c.created_at && c.created_at >= thisWeekStart);
  const checkedInPersons = new Set(weekCheckins.map(c => c.author));
  const hasCheckedInToday = coflowCheckins.some(c => c.created_at && c.created_at.startsWith(todayStr));

  // RSVP count for banner
  const rsvpGoingCount = nextD8 ? Object.values(nextD8.rsvp || {}).filter(v => v === 'yes').length : 0;

  const tabs: { key: D8Tab; label: string; emoji: string; badge?: string }[] = [
    { key: 'upcoming', label: 'Next D8', emoji: '\u{1F5D3}\uFE0F' },
    { key: 'checkin', label: 'Check-In', emoji: '\u2705', badge: `${checkedInPersons.size}/3` },
    { key: 'agenda', label: 'Agenda', emoji: '\u{1F4DD}', badge: nextD8?.agendaItems?.length ? `${nextD8.agendaItems.length}` : undefined },
    { key: 'archive', label: 'Archive', emoji: '\u{1F4DA}', badge: archivedD8s.length ? `${archivedD8s.length}` : undefined },
  ];

  return (
    <div className="cr-view" style={{ paddingTop: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--cr8w-primary)', marginBottom: 4 }}>
          PlayD8s
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          behind h0es doors meeting hub — where the cr8w gathers, checks in, and co-creates the flow
        </p>
      </div>

      {/* Wednesday check-in reminder banner */}
      {isWednesday && !hasCheckedInToday && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(var(--cr8w-primary-rgb, 123,168,157),0.15), rgba(var(--cr8w-secondary-rgb, 184,169,212),0.12))',
          border: '1.5px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.35)',
          borderRadius: 'var(--cr-radius-md)', padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{'\u{1F4CB}'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--cr8w-primary)', marginBottom: 2 }}>
              It's Wednesday — time to check in!
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {nextD8
                ? `${rsvpGoingCount}/3 confirmed for ${getDayOfWeekLabel(nextD8.date).split(',')[0]}'s BHD. Drop your check-in and lock in your vibe.`
                : 'Drop your weekly check-in before the next behind h0es doors. Confirm time, suggest a spot, and add agenda items.'
              }
            </div>
          </div>
          <button onClick={() => { setTab('checkin'); setShowCheckinForm(true); }} style={{
            ...btnPrimary, padding: '8px 16px', fontSize: '0.78rem', flexShrink: 0,
          }}>
            Check In
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--cr-radius-lg)',
            fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
            cursor: 'pointer', border: 'none',
            background: tab === t.key ? 'var(--cr8w-primary)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)',
            color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.25s ease', position: 'relative',
          }}>
            <span>{t.emoji}</span> {t.label}
            {t.badge && (
              <span style={{
                background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)',
                padding: '1px 6px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700,
                color: tab === t.key ? '#fff' : 'var(--cr8w-primary)',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── NEXT D8 TAB ── */}
      {tab === 'upcoming' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={labelStyle}>Next behind h0es doors</span>
            {!editingD8 && (
              <button onClick={() => setShowCreateD8(!showCreateD8)} style={{
                display: 'flex', alignItems: 'center', gap: 6, ...btnPrimary, padding: '8px 16px', fontSize: '0.8rem',
              }}>
                {showCreateD8 ? <X size={14} /> : <Plus size={14} />}
                {showCreateD8 ? 'Cancel' : 'Schedule D8'}
              </button>
            )}
          </div>

          {showCreateD8 && !editingD8 && (
            <CreateD8Form onSubmit={(d) => { onAddCoFlowDate(d); setShowCreateD8(false); }} />
          )}

          {editingD8 && nextD8 && (
            <EditD8Form
              d8={nextD8}
              onSave={(updates) => { onUpdateCoFlowDate(nextD8.id, updates); setEditingD8(false); }}
              onCancel={() => setEditingD8(false)}
            />
          )}

          {!nextD8 && !showCreateD8 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u{1F5D3}\uFE0F'}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                No upcoming d8s scheduled yet. Hit "Schedule D8" to set up the next behind h0es doors.
              </div>
            </div>
          )}

          {nextD8 && !editingD8 && <NextD8Card d8={nextD8} onUpdate={onUpdateCoFlowDate} onDelete={onDeleteCoFlowDate} onEdit={() => setEditingD8(true)} />}

          {/* Other upcoming */}
          {upcomingD8s.length > 1 && (
            <div style={{ marginTop: 20 }}>
              <span style={labelStyle}>Also On Deck</span>
              {upcomingD8s.slice(1).map(d8 => (
                <div key={d8.id} style={{ ...cardStyle, marginBottom: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatD8(d8.date)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 4 }}>
                      <span><Clock size={12} /> {getTimeDisplay(d8)}</span>
                      <span><MapPin size={12} /> {d8.location || 'TBD'}</span>
                      {d8.host && <span><Users size={12} /> {PERSONS[d8.host]?.name || d8.host}</span>}
                    </div>
                  </div>
                  <button onClick={() => onDeleteCoFlowDate(d8.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4 }}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming from shared Google Calendar */}
          {(() => {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const upcoming = kvCalEvents
              .filter(ev => new Date(ev.start) >= now)
              .sort((a, b) => a.start.localeCompare(b.start))
              .slice(0, 5);
            if (upcoming.length === 0) return null;
            return (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={labelStyle}>
                    <Calendar size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                    Upcoming from Calendar
                  </span>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--cr8w-primary)',
                      fontWeight: 600, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.3px',
                    }}
                  >Open Calendar ↗</a>
                </div>
                {upcoming.map(ev => {
                  const startDate = new Date(ev.start);
                  const isToday = startDate.toDateString() === new Date().toDateString();
                  const dateLabel = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const timeLabel = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                  return (
                    <div key={ev.id} style={{
                      ...cardStyle, marginBottom: 8, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isToday ? 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)' : 'var(--bg-card)',
                      border: isToday ? '1.5px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.25)' : '1px solid var(--border-soft)',
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
      )}

      {/* ── CHECK-IN TAB ── */}
      {tab === 'checkin' && (
        <CheckinTab
          coflowCheckins={coflowCheckins}
          weekCheckins={weekCheckins}
          checkedInPersons={checkedInPersons}
          showForm={showCheckinForm}
          setShowForm={setShowCheckinForm}
          onAddCheckin={onAddCoFlowCheckin}
          onDeleteCheckin={onDeleteCoFlowCheckin}
          nextD8={nextD8}
        />
      )}

      {/* ── AGENDA TAB ── */}
      {tab === 'agenda' && (
        <AgendaBuilder
          d8={nextD8}
          onUpdateD8={nextD8 ? (updates) => onUpdateCoFlowDate(nextD8.id, updates) : undefined}
        />
      )}

      {/* ── ARCHIVE TAB ── */}
      {tab === 'archive' && (
        <ArchiveTab
          archivedD8s={archivedD8s}
          expandedArchive={expandedArchive}
          setExpandedArchive={setExpandedArchive}
          onUpdateD8={onUpdateCoFlowDate}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT D8 RICH CARD
// ─────────────────────────────────────────────────────────────────────────────
function NextD8Card({ d8, onUpdate, onDelete, onEdit }: {
  d8: CoFlowDate;
  onUpdate: (id: number, u: Partial<CoFlowDate>) => void;
  onDelete: (id: number) => void;
  onEdit: () => void;
}) {
  const countdown = getCountdown(d8.date);
  const [showInlineAgenda, setShowInlineAgenda] = useState(false);
  const [inlineItem, setInlineItem] = useState('');

  function addInlineAgendaItem() {
    if (!inlineItem.trim()) return;
    const item = { id: Date.now(), text: inlineItem.trim(), lead: 'monny', timeEstimate: 10, done: false };
    onUpdate(d8.id, { agendaItems: [...(d8.agendaItems || []), item] });
    setInlineItem('');
  }

  function handleAddToCalendar() {
    const start = d8.date.replace(/-/g, '');
    const title = encodeURIComponent(`behind h0es doors${d8.theme ? ` \u2014 ${d8.theme}` : ''}`);
    const loc = encodeURIComponent(d8.location || '');
    const details = encodeURIComponent(`Host: ${d8.host ? PERSONS[d8.host]?.name || d8.host : 'TBD'}\nTheme: ${d8.theme || 'TBD'}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${start}&location=${loc}&details=${details}`;
    window.open(url, '_blank');
  }

  const statusColors: Record<string, { bg: string; border: string; label: string; emoji: string }> = {
    yes: { bg: 'rgba(107,175,107,0.12)', border: '#6BAF6B', label: 'Going', emoji: '\u2705' },
    no: { bg: 'rgba(212,107,107,0.12)', border: '#D46B6B', label: "Can't make it", emoji: '\u274C' },
    maybe: { bg: 'rgba(212,167,113,0.12)', border: '#D4A771', label: 'Maybe', emoji: '\u{1F914}' },
    pending: { bg: 'var(--sandstone)', border: 'var(--border-soft)', label: 'Pending', emoji: '\u23F3' },
  };

  return (
    <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      {/* Top gradient bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--cr8w-primary), var(--camel-sun))' }} />

      {/* Countdown badge */}
      <div style={{
        position: 'absolute', top: 14, right: 16,
        padding: '4px 12px', borderRadius: 20,
        background: countdown.urgent ? 'var(--cr8w-primary)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.12)',
        color: countdown.urgent ? '#fff' : 'var(--cr8w-primary)',
        fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        {countdown.label}
      </div>

      {/* Main info */}
      <div style={{ marginBottom: 20, paddingRight: 120 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)', margin: '0 0 8px' }}>
          {formatD8(d8.date)}
        </h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} /> {getTimeDisplay(d8)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={14} /> {d8.location || 'TBD'}
          </span>
          {d8.host && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={14} /> {PERSONS[d8.host]?.emoji} {PERSONS[d8.host]?.name || d8.host}
            </span>
          )}
        </div>
        {d8.theme && (
          <div style={{
            marginTop: 10, padding: '6px 14px', borderRadius: 'var(--cr-radius-sm)',
            background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)', border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)',
            fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--cr8w-primary)',
            display: 'inline-block',
          }}>
            {'\u2728'} {d8.theme}
          </div>
        )}
      </div>

      {/* RSVP Status */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>RSVP Status</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PERSON_KEYS.map(key => {
            const person = PERSONS[key];
            const status = d8.rsvp?.[key] || 'pending';
            const sc = statusColors[status];
            return (
              <div key={key} style={{
                flex: '1 1 140px', padding: '12px', borderRadius: 'var(--cr-radius-sm)',
                background: sc.bg, border: `1.5px solid ${sc.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: '1.4rem' }}>{person.emoji}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{person.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['yes', 'maybe', 'no'] as const).map(s => (
                    <button key={s} onClick={() => {
                      onUpdate(d8.id, { rsvp: { ...(d8.rsvp || {}), [key]: s } });
                    }} style={{
                      padding: '3px 8px', borderRadius: 10, fontSize: '0.62rem',
                      fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                      textTransform: 'uppercase', letterSpacing: '0.3px',
                      background: status === s ? sc.border : 'transparent',
                      color: status === s ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${status === s ? sc.border : 'var(--border-soft)'}`,
                    }}>
                      {s === 'yes' ? 'going' : s === 'maybe' ? 'maybe' : "can't"}
                    </button>
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {sc.emoji} {sc.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Agenda Preview */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={labelStyle}>Agenda ({(d8.agendaItems || []).length} items)</span>
          <button onClick={() => setShowInlineAgenda(!showInlineAgenda)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--cr8w-primary)',
            textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 600,
          }}>
            {showInlineAgenda ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {showInlineAgenda && (
          <div style={{ animation: 'cw-fadeInUp 0.2s ease' }}>
            {(d8.agendaItems || []).map((item, i) => {
              const lead = PERSONS[item.lead];
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                  borderBottom: i < (d8.agendaItems || []).length - 1 ? '1px solid var(--border-soft)' : 'none',
                  fontSize: '0.82rem', color: 'var(--text-secondary)',
                }}>
                  <span style={{ color: item.done ? '#6BAF6B' : 'var(--text-muted)', flexShrink: 0 }}>{item.done ? '\u2713' : '\u25CB'}</span>
                  <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>{item.text}</span>
                  <span style={{ fontSize: '0.68rem', color: lead?.color || 'var(--text-muted)' }}>{lead?.emoji}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>~{item.timeEstimate}m</span>
                </div>
              );
            })}
            {(d8.agendaItems || []).length === 0 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>No agenda items yet</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={inlineItem}
                onChange={e => setInlineItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addInlineAgendaItem(); }}
                placeholder="Quick add agenda item..."
                style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
              />
              <button onClick={addInlineAgendaItem} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '0.72rem' }}>
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={onEdit} style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Edit3 size={13} /> Edit D8
        </button>
        <button onClick={handleAddToCalendar} style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5 }}>
          <ExternalLink size={13} /> Add to Calendar
        </button>
        <button onClick={() => { if (confirm('Cancel this d8? It will be deleted.')) onDelete(d8.id); }} style={{
          ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5, color: '#D46B6B', borderColor: 'rgba(212,107,107,0.3)',
        }}>
          <X size={13} /> Cancel D8
        </button>
      </div>

      {/* Vibe check display */}
      {d8.vibeCheck && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--cr-radius-sm)', background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)', border: '1px solid rgba(var(--cr8w-primary-rgb, 123,168,157),0.15)', marginTop: 14 }}>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--cr8w-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Vibe Check</span>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{d8.vibeCheck}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE D8 FORM (enhanced)
// ─────────────────────────────────────────────────────────────────────────────
function CreateD8Form({ onSubmit }: {
  onSubmit: (d: Omit<CoFlowDate, 'id' | 'created_at'>) => void;
}) {
  const [date, setDate] = useState(getNextFriday());
  const [startTime, setStartTime] = useState('4:00 PM');
  const [endTime, setEndTime] = useState('8:00 PM');
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLoc, setShowCustomLoc] = useState(true);
  const [host, setHost] = useState('monny');
  const [theme, setTheme] = useState('');
  const [rsvp, setRsvp] = useState<Record<string, string>>({ sunshine: 'yes', monny: 'yes', bingle: 'yes' });

  const rsvpOptions = [
    { key: 'yes', label: 'Going', color: '#6BAF6B', bg: 'rgba(107,175,107,0.12)' },
    { key: 'maybe', label: 'Maybe', color: '#D4A771', bg: 'rgba(212,167,113,0.12)' },
    { key: 'no', label: "Can't make it", color: '#D46B6B', bg: 'rgba(212,107,107,0.12)' },
  ];

  return (
    <div style={{ ...cardStyle, marginBottom: 20, animation: 'cw-fadeInUp 0.3s ease' }}>
      {/* Date + Day Label */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--cr8w-primary)',
            marginTop: 4, fontWeight: 500,
          }}>
            {getDayOfWeekLabel(date)}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Host</label>
          <select value={host} onChange={e => setHost(e.target.value)} style={inputStyle}>
            {PERSON_KEYS.map(k => (
              <option key={k} value={k}>{PERSONS[k].emoji} {PERSONS[k].name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Time split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Start Time</label>
          <select value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>End Time</label>
          <select value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Location combobox */}
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Location</label>
        {!showCustomLoc ? (
          <div>
            <select value={location} onChange={e => {
              if (e.target.value === '__custom__') { setShowCustomLoc(true); setLocation(''); }
              else setLocation(e.target.value);
            }} style={inputStyle}>
              {LOCATION_SUGGESTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              <option value="__custom__">{'\u270F\uFE0F'} Type custom location...</option>
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={customLocation}
              onChange={e => setCustomLocation(e.target.value)}
              placeholder="Type a custom location..."
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button onClick={() => { if (customLocation.trim()) setLocation(customLocation.trim()); setShowCustomLoc(false); }} style={{ ...btnSecondary, fontSize: '0.72rem' }}>Set</button>
            <button onClick={() => { setShowCustomLoc(false); setLocation(''); }} style={{ ...btnSecondary, fontSize: '0.72rem', padding: '6px 10px' }}><X size={12} /></button>
          </div>
        )}
        {!showCustomLoc && location && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {'\u{1F4CD}'} {location}
          </div>
        )}
      </div>

      {/* Theme / Vibe */}
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Theme / Vibe <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
        <input
          value={theme}
          onChange={e => setTheme(e.target.value)}
          placeholder='e.g. "vision board night", "pottery + planning"'
          style={inputStyle}
        />
      </div>

      {/* RSVP Section */}
      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>RSVP Status</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PERSON_KEYS.map(key => {
            const person = PERSONS[key];
            const currentRsvp = rsvp[key] || 'yes';
            return (
              <div key={key} style={{
                flex: '1 1 140px', padding: '10px', borderRadius: 'var(--cr-radius-sm)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: '1.2rem' }}>{person.emoji}</span>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>{person.name}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {rsvpOptions.map(opt => (
                    <button key={opt.key} onClick={() => setRsvp(prev => ({ ...prev, [key]: opt.key }))} style={{
                      padding: '3px 7px', borderRadius: 8, fontSize: '0.58rem',
                      fontFamily: 'var(--font-label)', fontWeight: 600, cursor: 'pointer',
                      textTransform: 'uppercase', letterSpacing: '0.2px',
                      background: currentRsvp === opt.key ? opt.bg : 'transparent',
                      color: currentRsvp === opt.key ? opt.color : 'var(--text-muted)',
                      border: `1px solid ${currentRsvp === opt.key ? opt.color : 'var(--border-soft)'}`,
                    }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => onSubmit({
        date, startTime, endTime,
        timeRange: `${startTime} - ${endTime}`,
        location: showCustomLoc ? customLocation.trim() || 'TBD' : location,
        host, theme: theme.trim(),
        rsvp,
        agendaItems: [], notes: '', vibeCheck: '', status: 'upcoming',
      })} style={{ ...btnPrimary, marginTop: 16 }}>
        Schedule This D8
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT D8 FORM
// ─────────────────────────────────────────────────────────────────────────────
function EditD8Form({ d8, onSave, onCancel }: {
  d8: CoFlowDate;
  onSave: (updates: Partial<CoFlowDate>) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(d8.date);
  const [startTime, setStartTime] = useState(d8.startTime || '4:00 PM');
  const [endTime, setEndTime] = useState(d8.endTime || '8:00 PM');
  const [location, setLocation] = useState(d8.location || '');
  const [customLocation, setCustomLocation] = useState('');
  const isCustom = !LOCATION_SUGGESTIONS.includes(location);
  const [showCustomLoc, setShowCustomLoc] = useState(isCustom);
  const [host, setHost] = useState(d8.host || 'monny');
  const [theme, setTheme] = useState(d8.theme || '');
  const [vibeCheck, setVibeCheck] = useState(d8.vibeCheck || '');

  return (
    <div style={{ ...cardStyle, marginBottom: 20, animation: 'cw-fadeInUp 0.3s ease', borderColor: 'var(--cr8w-primary)', borderWidth: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--cr8w-primary)', fontWeight: 700 }}>
          {'\u270F\uFE0F'} Edit D8
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--cr8w-primary)', marginTop: 4 }}>
            {getDayOfWeekLabel(date)}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Host</label>
          <select value={host} onChange={e => setHost(e.target.value)} style={inputStyle}>
            {PERSON_KEYS.map(k => (
              <option key={k} value={k}>{PERSONS[k].emoji} {PERSONS[k].name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Start Time</label>
          <select value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>End Time</label>
          <select value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Location</label>
        {!showCustomLoc ? (
          <select value={location} onChange={e => {
            if (e.target.value === '__custom__') { setShowCustomLoc(true); setCustomLocation(location); }
            else setLocation(e.target.value);
          }} style={inputStyle}>
            {LOCATION_SUGGESTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            <option value="__custom__">{'\u270F\uFE0F'} Type custom...</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={customLocation} onChange={e => setCustomLocation(e.target.value)} placeholder="Custom location..." style={{ ...inputStyle, flex: 1 }} autoFocus />
            <button onClick={() => { setLocation(customLocation.trim() || location); setShowCustomLoc(false); }} style={btnSecondary}>Set</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Theme / Vibe</label>
        <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Session theme..." style={inputStyle} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Vibe Check Note</label>
        <input value={vibeCheck} onChange={e => setVibeCheck(e.target.value)} placeholder="What's the energy?" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => onSave({
          date, startTime, endTime, timeRange: `${startTime} - ${endTime}`,
          location: showCustomLoc ? customLocation.trim() || location : location,
          host, theme: theme.trim(), vibeCheck: vibeCheck.trim(),
        })} style={btnPrimary}>
          Save Changes
        </button>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN TAB (enhanced)
// ─────────────────────────────────────────────────────────────────────────────
function CheckinTab({ coflowCheckins, weekCheckins, checkedInPersons, showForm, setShowForm, onAddCheckin, onDeleteCheckin, nextD8 }: {
  coflowCheckins: CoFlowCheckin[];
  weekCheckins: CoFlowCheckin[];
  checkedInPersons: Set<string>;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  onAddCheckin: (c: Omit<CoFlowCheckin, 'id' | 'created_at'>) => void;
  onDeleteCheckin: (id: number) => void;
  nextD8?: CoFlowDate;
}) {
  const moodLookup: Record<string, { emoji: string; label: string; color: string }> = {};
  MOOD_OPTIONS.forEach(m => { moodLookup[m.key] = m; });

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        ...cardStyle, marginBottom: 16, padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(var(--cr8w-primary-rgb, 123,168,157),0.06), rgba(var(--cr8w-secondary-rgb, 184,169,212),0.04))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {checkedInPersons.size}/3 checked in this week
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERSON_KEYS.map(key => {
              const p = PERSONS[key];
              const done = checkedInPersons.has(key);
              return (
                <span key={key} style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                  background: done ? `${p.color}22` : 'var(--bg-elevated)',
                  border: `2px solid ${done ? p.color : 'var(--border-soft)'}`,
                  opacity: done ? 1 : 0.4,
                }} title={`${p.name} ${done ? '\u2713' : 'pending'}`}>
                  {p.emoji}
                </span>
              );
            })}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: 6, ...btnPrimary, padding: '8px 16px', fontSize: '0.8rem', flexShrink: 0,
        }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Check In'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Weekly Co-Flow Check</span>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          Drop your check-in before the next behind h0es doors. Share your vibe, confirm time, suggest a spot, add agenda items.
        </p>
      </div>

      {showForm && (
        <CheckinForm onSubmit={(c) => { onAddCheckin(c); setShowForm(false); }} nextD8={nextD8} />
      )}

      {coflowCheckins.length === 0 && !showForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u2705'}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
            No check-ins yet this week. Be the first to drop your vibe.
          </div>
        </div>
      )}

      {[...coflowCheckins].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(ci => {
        const p = PERSONS[ci.author];
        const mood = ci.mood ? moodLookup[ci.mood] : null;
        return (
          <div key={ci.id} style={{ ...cardStyle, marginBottom: 10, borderLeft: `3px solid ${p?.color || 'var(--cr8w-primary)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.1rem' }}>{p?.emoji || '\u{1F300}'}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p?.name || ci.author}</span>
                {mood && (
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem',
                    fontFamily: 'var(--font-label)', fontWeight: 600,
                    background: `${mood.color}18`, color: mood.color,
                    border: `1px solid ${mood.color}33`,
                  }}>
                    {mood.emoji} {mood.label}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatTimestamp(ci.created_at)}</span>
              </div>
              <button onClick={() => onDeleteCheckin(ci.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4 }}><X size={13} /></button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, flexWrap: 'wrap' }}>
              <span>{ci.confirmTime ? '\u2705 Time works' : '\u2753 Time TBD'}</span>
              {ci.timePreference && <span>{'\u{1F552}'} Prefers: {ci.timePreference}</span>}
              {ci.locationSuggestion && <span>{'\u{1F4CD}'} {ci.locationSuggestion}</span>}
            </div>
            {ci.notes && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, padding: '8px 12px', borderRadius: 'var(--cr-radius-sm)', background: 'rgba(0,0,0,0.03)', lineHeight: 1.5, fontStyle: 'italic' }}>
                {ci.notes}
              </div>
            )}
            {ci.agendaItems?.length > 0 && (
              <div>
                <span style={{ ...labelStyle, marginBottom: 4 }}>Agenda Items</span>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {ci.agendaItems.map((item, i) => (
                    <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 2, lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN FORM (enhanced with mood, time pref, notes)
// ─────────────────────────────────────────────────────────────────────────────
function CheckinForm({ onSubmit, nextD8 }: {
  onSubmit: (c: Omit<CoFlowCheckin, 'id' | 'created_at'>) => void;
  nextD8?: CoFlowDate;
}) {
  const [author, setAuthor] = useState('monny');
  const [mood, setMood] = useState('sun');
  const [confirmTime, setConfirmTime] = useState(true);
  const [timePreference, setTimePreference] = useState('');
  const [locationSuggestion, setLocationSuggestion] = useState('');
  const [showCustomLoc, setShowCustomLoc] = useState(false);
  const [customLoc, setCustomLoc] = useState('');
  const [agendaText, setAgendaText] = useState('');
  const [notes, setNotes] = useState('');

  const weekOf = new Date().toISOString().split('T')[0];

  return (
    <div style={{ ...cardStyle, marginBottom: 20, animation: 'cw-fadeInUp 0.3s ease' }}>
      {/* Who + Mood */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Who's Checking In</label>
          <select value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle}>
            {PERSON_KEYS.map(k => <option key={k} value={k}>{PERSONS[k].emoji} {PERSONS[k].name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>What's your vibe?</label>
          <div style={{ display: 'flex', gap: 4, paddingTop: 2 }}>
            {MOOD_OPTIONS.map(m => (
              <button key={m.key} onClick={() => setMood(m.key)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 'var(--cr-radius-sm)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: 'pointer',
                background: mood === m.key ? `${m.color}18` : 'var(--bg-elevated)',
                border: `1.5px solid ${mood === m.key ? m.color : 'var(--border-soft)'}`,
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{m.emoji}</span>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.55rem', fontWeight: 600, color: mood === m.key ? m.color : 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Time + Availability */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Availability for next BHD</label>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button onClick={() => setConfirmTime(true)} style={{
              padding: '8px 16px', borderRadius: 'var(--cr-radius-sm)', cursor: 'pointer',
              background: confirmTime ? 'rgba(107,175,107,0.12)' : 'var(--sandstone)',
              border: confirmTime ? '1.5px solid #6BAF6B' : '1px solid var(--border-soft)',
              color: confirmTime ? '#3A7A3A' : 'var(--text-muted)',
              fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
            }}>{'\u2705'} Yes</button>
            <button onClick={() => setConfirmTime(false)} style={{
              padding: '8px 16px', borderRadius: 'var(--cr-radius-sm)', cursor: 'pointer',
              background: !confirmTime ? 'rgba(212,167,113,0.12)' : 'var(--sandstone)',
              border: !confirmTime ? '1.5px solid #D4A771' : '1px solid var(--border-soft)',
              color: !confirmTime ? '#8A6A20' : 'var(--text-muted)',
              fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
            }}>Needs Adjusting</button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Time preference</label>
          <select value={timePreference} onChange={e => setTimePreference(e.target.value)} style={inputStyle}>
            <option value="">No preference</option>
            {TIME_OPTIONS.slice(0, -1).map((t, i) => (
              <option key={t} value={`${t} - ${TIME_OPTIONS[i + 1]}`}>{t} - {TIME_OPTIONS[i + 1]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Location suggestion */}
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Spot suggestion</label>
        {!showCustomLoc ? (
          <select value={locationSuggestion} onChange={e => {
            if (e.target.value === '__custom__') { setShowCustomLoc(true); }
            else setLocationSuggestion(e.target.value);
          }} style={inputStyle}>
            <option value="">No suggestion</option>
            {LOCATION_SUGGESTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            <option value="__custom__">{'\u270F\uFE0F'} Type custom...</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={customLoc} onChange={e => setCustomLoc(e.target.value)} placeholder="Suggest a spot..." style={{ ...inputStyle, flex: 1 }} autoFocus />
            <button onClick={() => { setLocationSuggestion(customLoc.trim()); setShowCustomLoc(false); }} style={btnSecondary}>Set</button>
            <button onClick={() => { setShowCustomLoc(false); }} style={{ ...btnSecondary, padding: '6px 10px' }}><X size={12} /></button>
          </div>
        )}
      </div>

      {/* Agenda drop */}
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Agenda drop (one per line)</label>
        <textarea value={agendaText} onChange={e => setAgendaText(e.target.value)} placeholder="What do you want to bring to the table?" style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
      </div>

      {/* Notes */}
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(anything else on your mind)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Free thoughts..." style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} />
      </div>

      <button onClick={() => onSubmit({
        weekOf, author, confirmTime, mood,
        locationSuggestion: locationSuggestion.trim(),
        timePreference: timePreference || undefined,
        notes: notes.trim() || undefined,
        agendaItems: agendaText.split('\n').map(s => s.trim()).filter(Boolean),
      })} style={{ ...btnPrimary, marginTop: 16 }}>
        Drop My Check-In
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA BUILDER (enhanced with lock)
// ─────────────────────────────────────────────────────────────────────────────
function AgendaBuilder({ d8, onUpdateD8 }: {
  d8?: CoFlowDate;
  onUpdateD8?: (updates: Partial<CoFlowDate>) => void;
}) {
  const [newItem, setNewItem] = useState('');
  const [newLead, setNewLead] = useState('monny');
  const [newTime, setNewTime] = useState('10');

  if (!d8 || !onUpdateD8) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u{1F4DD}'}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
          Schedule a d8 first, then build the agenda here.
        </div>
      </div>
    );
  }

  const agenda = d8.agendaItems || [];
  const totalMins = agenda.reduce((sum, item) => sum + (item.timeEstimate || 0), 0);
  const locked = d8.agendaLocked || false;

  function addAgendaItem() {
    if (!newItem.trim() || locked) return;
    const item = { id: Date.now(), text: newItem.trim(), lead: newLead, timeEstimate: parseInt(newTime) || 10, done: false };
    onUpdateD8!({ agendaItems: [...agenda, item] });
    setNewItem('');
  }

  function toggleDone(itemId: number) {
    onUpdateD8!({ agendaItems: agenda.map(i => i.id === itemId ? { ...i, done: !i.done } : i) });
  }

  function removeItem(itemId: number) {
    if (locked) return;
    onUpdateD8!({ agendaItems: agenda.filter(i => i.id !== itemId) });
  }

  function moveItem(idx: number, dir: -1 | 1) {
    if (locked) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= agenda.length) return;
    const updated = [...agenda];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onUpdateD8!({ agendaItems: updated });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={labelStyle}>Agenda for {formatD8(d8.date)}</span>
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--cr8w-primary)', marginLeft: 8 }}>
            ~{totalMins} min total {'\u00B7'} {agenda.length} items
          </span>
        </div>
        <button onClick={() => onUpdateD8!({ agendaLocked: !locked })} style={{
          ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5,
          background: locked ? 'rgba(107,175,107,0.12)' : 'var(--sandstone)',
          borderColor: locked ? '#6BAF6B' : 'var(--border-soft)',
          color: locked ? '#3A7A3A' : 'var(--text-secondary)',
        }}>
          {locked ? <Lock size={13} /> : <Unlock size={13} />}
          {locked ? 'Locked' : 'Lock Agenda'}
        </button>
      </div>

      {locked && (
        <div style={{
          padding: '8px 14px', borderRadius: 'var(--cr-radius-sm)',
          background: 'rgba(107,175,107,0.08)', border: '1px solid rgba(107,175,107,0.2)',
          fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#5A9A5A',
          marginBottom: 12,
        }}>
          {'\u{1F512}'} Agenda is locked for the upcoming BHD. Unlock to make changes.
        </div>
      )}

      {/* Add item (only when not locked) */}
      {!locked && (
        <div style={{ ...cardStyle, marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Agenda item..." style={{ ...inputStyle, flex: '1 1 200px' }} onKeyDown={e => { if (e.key === 'Enter') addAgendaItem(); }} />
            <select value={newLead} onChange={e => setNewLead(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              {Object.entries(PERSONS).map(([k, p]) => <option key={k} value={k}>{p.emoji} {p.name}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ ...inputStyle, width: 55 }} min="1" placeholder="min" />
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>min</span>
            </div>
            <button onClick={addAgendaItem} style={{ ...btnPrimary, padding: '8px 16px', fontSize: '0.78rem' }}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Agenda items */}
      {agenda.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No agenda items yet. Add one above.
        </div>
      ) : (
        <div>
          {agenda.map((item, idx) => {
            const lead = PERSONS[item.lead];
            return (
              <div key={item.id} style={{
                ...cardStyle, marginBottom: 6, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: item.done ? 0.5 : 1, transition: 'opacity 0.2s',
              }}>
                {!locked && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveItem(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>{'\u25B2'}</button>
                    <button onClick={() => moveItem(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1 }}>{'\u25BC'}</button>
                  </div>
                )}
                <button onClick={() => toggleDone(item.id)} style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: item.done ? '#6BAF6B' : 'transparent',
                  border: item.done ? '2px solid #6BAF6B' : '2px solid var(--border-soft)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.7rem',
                }}>
                  {item.done && '\u2713'}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    <span style={{ color: lead?.color || 'var(--text-muted)' }}>{lead?.emoji} {lead?.name || item.lead}</span>
                    <span>~{item.timeEstimate}min</span>
                  </div>
                </div>
                {!locked && (
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4 }}><X size={13} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notes + Vibe Check */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={cardStyle}>
          <span style={labelStyle}>Meeting Notes</span>
          <textarea
            value={d8.notes || ''}
            onChange={e => onUpdateD8({ notes: e.target.value })}
            placeholder="Capture what flows..."
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          />
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Vibe Check</span>
          <textarea
            value={d8.vibeCheck || ''}
            onChange={e => onUpdateD8({ vibeCheck: e.target.value })}
            placeholder="How did the energy feel?"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button onClick={() => onUpdateD8({ status: 'archived' })} style={{
              ...btnSecondary, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Archive size={13} /> Archive This D8
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE TAB (rich recap cards)
// ─────────────────────────────────────────────────────────────────────────────
function ArchiveTab({ archivedD8s, expandedArchive, setExpandedArchive, onUpdateD8 }: {
  archivedD8s: CoFlowDate[];
  expandedArchive: number | null;
  setExpandedArchive: (v: number | null) => void;
  onUpdateD8: (id: number, u: Partial<CoFlowDate>) => void;
}) {
  return (
    <div>
      <span style={labelStyle}>Past behind h0es doors</span>
      {archivedD8s.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u{1F4DA}'}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
            No archived sessions yet. Past d8s will appear here after they wrap.
          </div>
        </div>
      )}
      {archivedD8s.map(d8 => {
        const isExpanded = expandedArchive === d8.id;
        const attendees = Object.entries(d8.rsvp || {}).filter(([_, s]) => s === 'yes').map(([k]) => PERSONS[k]);
        const agendaDone = (d8.agendaItems || []).filter(i => i.done).length;
        const agendaTotal = (d8.agendaItems || []).length;
        return (
          <div key={d8.id} style={{ ...cardStyle, marginBottom: 12, overflow: 'hidden', borderLeft: `3px solid var(--cr8w-primary)` }}>
            <div onClick={() => setExpandedArchive(isExpanded ? null : d8.id)} style={{ cursor: 'pointer' }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 4 }}>{formatD8(d8.date)}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {d8.location || 'No location'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {getTimeDisplay(d8)}</span>
                    {d8.host && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={12} /> {PERSONS[d8.host]?.name || d8.host}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {attendees.map((a, i) => a && <span key={i} title={a.name} style={{ fontSize: '1rem' }}>{a.emoji}</span>)}
                    {attendees.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No RSVPs</span>}
                  </div>
                  {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                </div>
              </div>

              {/* Summary badges */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {d8.theme && (
                  <span style={{ padding: '2px 10px', borderRadius: 10, background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.08)', color: 'var(--cr8w-primary)', fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {'\u2728'} {d8.theme}
                  </span>
                )}
                {agendaTotal > 0 && (
                  <span style={{ padding: '2px 10px', borderRadius: 10, background: 'rgba(107,175,107,0.08)', color: '#5A9A5A', fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 600 }}>
                    {agendaDone}/{agendaTotal} agenda items done
                  </span>
                )}
                <span style={{ padding: '2px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 600 }}>
                  {attendees.length} attended
                </span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                {/* Agenda recap */}
                {agendaTotal > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={labelStyle}>Agenda Items</span>
                    {(d8.agendaItems || []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: item.done ? '#6BAF6B' : 'var(--text-muted)' }}>{item.done ? '\u2713' : '\u25CB'}</span>
                        <span style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1, flex: 1 }}>{item.text}</span>
                        {item.lead && <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: PERSONS[item.lead]?.color || 'var(--text-muted)' }}>{PERSONS[item.lead]?.emoji} {PERSONS[item.lead]?.name || item.lead}</span>}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>~{item.timeEstimate}m</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Meeting notes */}
                {d8.notes && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={labelStyle}>Meeting Notes</span>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d8.notes}</p>
                  </div>
                )}

                {/* Session Notes (post-BHD reflection) */}
                <div style={{ marginBottom: 12 }}>
                  <span style={labelStyle}>Session Notes</span>
                  <textarea
                    value={d8.sessionNotes || ''}
                    onChange={e => onUpdateD8(d8.id, { sessionNotes: e.target.value })}
                    placeholder="Reflect on the session \u2014 what worked, what to carry forward..."
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  />
                </div>

                {/* Vibe check */}
                {d8.vibeCheck && (
                  <div style={{ padding: '8px 12px', borderRadius: 'var(--cr-radius-sm)', background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.62rem', color: 'var(--cr8w-primary)', textTransform: 'uppercase' }}>Vibe Check</span>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{d8.vibeCheck}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
