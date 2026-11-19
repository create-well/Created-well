import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDashboard } from '../../../contexts/DashboardContext';
import { PERSONS, formatTimestamp } from '../data';
import { parseDateValue, localDateString } from '../../../lib/dateLabel';
import { taskDueLabel } from '../../../lib/homePanels';
import type { Task, CoFlowCheckin, CoFlowDate } from '../api';

// ── Team check-in (Phase 3, packet M §2.4) ──────────────────────────────────
// The People Team board: one card per person whose filed Roles include
// "Core Team" (the Roles multi-select rides Station.description as a
// comma-joined string — normalizePerson). Cards read in the Waiting On
// Us row language (src/app/components/HomePanels.tsx): open Moves due
// inside the current week plus each member's latest check-in care
// state. The filing surface — form + list — is rehoused here from
// CoFlowD8sView's CheckinTab/CheckinForm (copied, not moved; the view
// retires in its own leg).

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

// The three filing hosts — the only authors the check-in form offers.
const PERSON_KEYS = ['sunshine', 'monny', 'bingle'] as const;

/** Queue row status wording (packet H §1), mirrored from HomePanels. */
const TASK_STATUS_WORDS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
};

const HOLDING_PREVIEW_COUNT = 3;

// ── Shared styles (mirrored from the check-in surface they came from) ───────
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

// ── Derivations ─────────────────────────────────────────────────────────────

// Roles ride Station.description as the Roles multi-select comma-joined
// (normalizePerson: getMultiSelect(...).join(', ')). Membership matches
// "Core Team" as a whole comma-separated token, never a substring.
function isCoreTeamMember(station: { description: string }): boolean {
  return station.description.split(',').map(tok => tok.trim()).includes('Core Team');
}

// Open = the Waiting On Us queue definition (homeTasks, packet H §1):
// done and dropped never render, never count.
function isOpenTask(t: Task): boolean {
  return t.status !== 'done' && t.status !== 'dropped';
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = parseDateValue(dateStr);
  return d !== null && d >= today;
}

// The check-in is named "Team check-in" here; the old "Co-flow session"
// fallback wording does not survive the rehouse.
function sessionTitle(d8?: CoFlowDate): string {
  if (!d8) return 'session';
  return d8.title || d8.theme || d8.flowType || 'session';
}

// ── Member card ─────────────────────────────────────────────────────────────
interface MemberEntry {
  slug: string;
  name: string;
  emoji: string;
  color?: string;
  holding: Task[];
  latestCheckin?: CoFlowCheckin;
}

function MemberCard({ member }: { member: MemberEntry }) {
  const moodLookup: Record<string, { emoji: string; label: string; color: string }> = {};
  MOOD_OPTIONS.forEach(m => { moodLookup[m.key] = m; });
  const mood = member.latestCheckin?.mood ? moodLookup[member.latestCheckin.mood] : null;
  const overflow = member.holding.length - HOLDING_PREVIEW_COUNT;

  return (
    <section
      className="home-panel"
      style={{ borderLeft: `3px solid ${member.color || 'var(--cr8w-primary)'}` }}
      aria-label={member.name}
    >
      <div className="home-panel-head">
        <h3 className="home-panel-title">
          <span style={{ marginRight: 6 }}>{member.emoji}</span>{member.name}
        </h3>
      </div>

      <div className="home-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="home-depth-tag">Holding this week</span>
        {member.holding.length > 0 ? (
          <>
            <div className="home-metric-row">
              <span className="home-metric-sm">{member.holding.length}</span>
              <span className="home-metric-label">due this week</span>
            </div>
            <ul className="home-task-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {member.holding.slice(0, HOLDING_PREVIEW_COUNT).map(t => (
                <li key={t.id} className="home-task-row">
                  <span className="home-task-title">{t.title}</span>
                  <span className="home-task-meta">
                    <span className={`home-task-status${t.status === 'blocked' ? ' blocked' : ''}`}>
                      {TASK_STATUS_WORDS[t.status] ?? t.status}
                    </span>
                    <span className="home-task-due">{taskDueLabel(t)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {overflow > 0 && (
              <span className="home-empty">
                {overflow === 1 ? '1 more open' : `${overflow} more open`}
              </span>
            )}
          </>
        ) : (
          <p className="home-empty">Nothing due this week.</p>
        )}

        <span className="home-depth-tag" style={{ marginTop: 4 }}>Care state</span>
        {member.latestCheckin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Filed {formatTimestamp(member.latestCheckin.created_at)}
            </span>
          </div>
        ) : (
          <p className="home-empty">No check-in filed</p>
        )}
      </div>
    </section>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────
export function TeamBoard() {
  const { data, actions } = useDashboard();
  const [showCheckinForm, setShowCheckinForm] = useState(false);

  // Current-week window, mirrored from the weekCheckins computation the
  // check-in surface already uses: the local Sunday (today - dayOfWeek)
  // through the following Saturday.
  const thisWeekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    return localDateString(d);
  })();
  const nextWeekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 7);
    return localDateString(d);
  })();

  // Membership: filed Roles include "Core Team". The task-owner slug is
  // the person's Name lowercased (buildOwnerSlugIndex's key space), and
  // the check-in author keys are the same slugs — one mapping serves
  // both slices. Members without a check-in key (Omar, Pia) simply
  // never match an entry and read "No check-in filed".
  const members: MemberEntry[] = data.stations
    .filter(isCoreTeamMember)
    .map(station => {
      const slug = station.name.trim().toLowerCase();
      const profile = PERSONS[slug];
      const holding = data.tasks
        .filter(t => t.person === slug && isOpenTask(t))
        .filter(t => {
          const due = (t.due_date || '').slice(0, 10);
          return due >= thisWeekStart && due < nextWeekStart;
        })
        .sort((a, b) => {
          const byDue = (a.due_date || '').slice(0, 10).localeCompare((b.due_date || '').slice(0, 10));
          return byDue !== 0 ? byDue : a.id - b.id;
        });
      const latestCheckin = [...data.coFlowCheckins]
        .filter(c => c.author === slug)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
      return {
        slug,
        name: profile?.name ?? station.name,
        emoji: profile?.emoji ?? station.emoji ?? '\u{1F464}',
        color: profile?.color,
        holding,
        latestCheckin,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // The next scheduled behind h0es doors — the form's availability
  // context (same upcoming filter the retired view used).
  const nextD8 = data.coFlowDates
    .filter(d => (['idea', 'ready', 'approved', 'scheduled'] as const).includes(d.status as never) && isUpcoming(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const weekCheckins = data.coFlowCheckins.filter(c => c.created_at && c.created_at >= thisWeekStart);
  const checkedInPersons = new Set(weekCheckins.map(c => c.author));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Core Team cards */}
      <div>
        <div className="home-panel-head">
          <h2 className="home-panel-title">Core Team</h2>
          <span className="home-depth-tag">{members.length} member{members.length === 1 ? '' : 's'}</span>
        </div>
        {members.length === 0 ? (
          <p className="home-empty">No Core Team members on file yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {members.map(m => <MemberCard key={m.slug} member={m} />)}
          </div>
        )}
      </div>

      {/* Team check-in — filing surface */}
      <section aria-label="Team check-in">
        <div className="home-panel-head">
          <h2 className="home-panel-title">Team check-in</h2>
          <span className="home-depth-tag">Weekly</span>
        </div>

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
          <button onClick={() => setShowCheckinForm(!showCheckinForm)} style={{
            display: 'flex', alignItems: 'center', gap: 6, ...btnPrimary, padding: '8px 16px', fontSize: '0.8rem', flexShrink: 0,
          }}>
            {showCheckinForm ? <X size={14} /> : <Plus size={14} />}
            {showCheckinForm ? 'Cancel' : 'Check In'}
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Drop your check-in before the next {sessionTitle(nextD8)}. Share your vibe, confirm time, suggest a spot, add agenda items.
          </p>
        </div>

        {showCheckinForm && (
          <CheckinForm onSubmit={(c) => { actions.addCoFlowCheckin(c); setShowCheckinForm(false); }} nextD8={nextD8} />
        )}

        {data.coFlowCheckins.length === 0 && !showCheckinForm && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u2705'}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
              No check-ins yet this week. Be the first to drop your vibe.
            </div>
          </div>
        )}

        {[...data.coFlowCheckins].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(ci => {
          const p = PERSONS[ci.author];
          const moodLookup: Record<string, { emoji: string; label: string; color: string }> = {};
          MOOD_OPTIONS.forEach(m => { moodLookup[m.key] = m; });
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
                <button onClick={() => actions.deleteCoFlowCheckin(ci.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4 }}><X size={13} /></button>
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
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN FORM (rehoused from CoFlowD8sView — same fields, same submit shape)
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

  const weekOf = localDateString();

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
          <label style={labelStyle}>Availability for the next {sessionTitle(nextD8)}</label>
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
