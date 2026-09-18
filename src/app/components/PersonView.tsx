import React, { useState, useEffect } from 'react';
import {
  PERSONS, WELLSHEET_PROMPTS, CALENDAR_EVENTS, GLOSSARY, MILESTONES, STATIONS_DEFAULT,
  HD_PROFILES, GOOGLE_ACCOUNTS, MBODY_PRACTICES,
  getDaysToLaunch, formatDate, formatEventDate, formatTimestamp, getEventColor, truncate, capitalize, getDayOfYear,
  type ActionItem, type MomentumItem, type NoteItem, type Station
} from './data';

type PersonTab = 'flow' | 'work' | 'depth';

interface PersonViewProps {
  person: string;
  onNavigate: (view: string) => void;
  actionItems: ActionItem[];
  momentumItems: MomentumItem[];
  wellNotes: NoteItem[];
  stations: Station[];
  onAddTask: () => void;
  onUpdateTaskStatus: (id: number, status: string) => void;
  onAddMomentum: (content: string, person: string) => void;
  onAddNote: (content: string, author: string) => void;
}

const STATUS_ORDER = ['todo', 'in_progress', 'done', 'blocked'];

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

// HD Type Finder calculator data
const profileCombos = ['1/3', '1/4', '2/4', '2/5', '3/5', '3/6', '4/6', '4/1', '5/1', '5/2', '6/2', '6/3'];
const profileNames: Record<string, string> = {
  '1/3': 'Investigator / Martyr', '1/4': 'Investigator / Opportunist',
  '2/4': 'Hermit / Opportunist', '2/5': 'Hermit / Heretic',
  '3/5': 'Martyr / Heretic', '3/6': 'Martyr / Role Model',
  '4/6': 'Opportunist / Role Model', '4/1': 'Opportunist / Investigator',
  '5/1': 'Heretic / Investigator', '5/2': 'Heretic / Hermit',
  '6/2': 'Role Model / Hermit', '6/3': 'Role Model / Martyr'
};
const typeDescriptions: Record<string, string> = {
  'Generator': "You have deep, sustainable sacral energy. When you respond to what lights you up, you can work tirelessly with satisfaction.",
  'Manifesting Generator': "You're a multi-passionate powerhouse — Generator energy with Manifestor speed. Respond, then move fast.",
  'Projector': "You're a guide and seer. Your gift is seeing deeply into others and systems. Wait for recognition and invitation.",
  'Manifestor': "You're here to initiate and impact. Inform others before acting. When you do, peace follows.",
  'Reflector': "The rarest type. You reflect the health of your community. Major decisions need a full lunar cycle."
};

function firstSentence(text: string): string {
  const dot = text.indexOf('. ');
  const dash = text.indexOf(' — ');
  let idx = Math.min(dot > -1 ? dot : Infinity, dash > -1 ? dash : Infinity);
  if (idx === Infinity || idx > 90) return text.split('. ')[0] + '.';
  if (dash > -1 && (dot === -1 || dash < dot)) return text.substring(0, dash) + '.';
  return text.substring(0, dot + 1);
}

export function PersonView({
  person, onNavigate, actionItems, momentumItems, wellNotes, stations,
  onAddTask, onUpdateTaskStatus, onAddMomentum, onAddNote
}: PersonViewProps) {
  const [activeTab, setActiveTab] = useState<PersonTab>('flow');
  const [filter, setFilter] = useState('active');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [sparkInput, setSparkInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());
  const [showHDCalc, setShowHDCalc] = useState(false);
  const [hdCalcDate, setHdCalcDate] = useState('');
  const [hdCalcTime, setHdCalcTime] = useState('');
  const [hdCalcResult, setHdCalcResult] = useState<null | Record<string, string>>(null);
  const [showMBodyModal, setShowMBodyModal] = useState(false);
  const [mbodyResult, setMbodyResult] = useState<typeof MBODY_PRACTICES[0] | null>(null);
  const [mbodySpinning, setMbodySpinning] = useState(false);
  const [tabTransition, setTabTransition] = useState(true);

  const p = PERSONS[person];
  if (!p) return null;

  const personItems = actionItems.filter(i => i.person === person);
  const personMomentum = momentumItems.filter(i => i.person === person);

  const prompts = WELLSHEET_PROMPTS[person] || [];
  const dayOfYear = getDayOfYear(new Date());
  const prompt = prompts[dayOfYear % prompts.length] || '';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const stationList = stations.length > 0 ? stations : STATIONS_DEFAULT;

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const personEvents = CALENDAR_EVENTS
    .filter(e => e.persons.includes(person) && new Date(e.date + 'T00:00:00') >= todayDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const urgentItems = personItems.filter(i => i.status !== 'done').sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    return 1;
  });
  const dueSoon = urgentItems.filter(i => i.due_date).slice(0, 5);
  const clarityQueue = personItems.filter(i => i.status === 'blocked');

  const hd = HD_PROFILES[person];
  const hdQuote = hd ? hd.hdQuotes[dayOfYear % hd.hdQuotes.length] : '';

  function switchTab(tab: PersonTab) {
    setTabTransition(false);
    setTimeout(() => { setActiveTab(tab); setTabTransition(true); }, 80);
  }

  function addSpark() {
    if (!sparkInput.trim()) return;
    onAddMomentum(sparkInput.trim(), person);
    setSparkInput('');
  }

  function addNote() {
    if (!noteInput.trim()) return;
    onAddNote(noteInput.trim(), person);
    setNoteInput('');
  }

  function toggleAccordion(id: string) {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function spinMBody() {
    if (mbodySpinning) return;
    setMbodySpinning(true);
    setMbodyResult(null);
    setTimeout(() => {
      const practice = MBODY_PRACTICES[Math.floor(Math.random() * MBODY_PRACTICES.length)];
      setMbodyResult(practice);
      setMbodySpinning(false);
    }, 900);
  }

  function calculateHD() {
    if (!hdCalcDate) {
      setHdCalcResult({ error: 'Please enter your birth date to continue.' });
      return;
    }
    const birthDate = new Date(hdCalcDate + 'T' + (hdCalcTime || '12:00'));
    const month = birthDate.getMonth() + 1;
    const hour = birthDate.getHours();
    const dayOfYearNum = getDayOfYear(birthDate);
    const seed = dayOfYearNum + (hour * 15);
    const typeIndex = seed % 100;
    let hdType: string, strategy: string, authority: string, signature: string, notSelf: string;
    if (typeIndex < 35) {
      hdType = 'Generator'; strategy = 'To Respond'; signature = 'Satisfaction'; notSelf = 'Frustration';
      authority = seed % 3 === 0 ? 'Sacral' : 'Emotional (Solar Plexus)';
    } else if (typeIndex < 70) {
      hdType = 'Manifesting Generator'; strategy = 'To Respond + Inform'; signature = 'Satisfaction + Peace'; notSelf = 'Frustration + Anger';
      authority = seed % 2 === 0 ? 'Emotional (Solar Plexus)' : 'Sacral';
    } else if (typeIndex < 90) {
      hdType = 'Projector'; strategy = 'Wait for the Invitation'; signature = 'Success'; notSelf = 'Bitterness';
      const authOptions = ['Splenic', 'Ego', 'Self-Projected', 'Mental'];
      authority = authOptions[seed % authOptions.length];
    } else if (typeIndex < 99) {
      hdType = 'Manifestor'; strategy = 'To Inform'; signature = 'Peace'; notSelf = 'Anger';
      authority = seed % 2 === 0 ? 'Emotional (Solar Plexus)' : 'Splenic';
    } else {
      hdType = 'Reflector'; strategy = 'Wait a Lunar Cycle (28 days)'; signature = 'Surprise'; notSelf = 'Disappointment'; authority = 'Lunar';
    }
    const profile = profileCombos[(dayOfYearNum + month) % profileCombos.length];
    setHdCalcResult({ hdType, strategy, authority, signature, notSelf, profile, desc: typeDescriptions[hdType] });
  }

  // Calendar data
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const today2 = new Date();
  const calCells: React.ReactNode[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    calCells.push(<div key={`prev-${i}`} className="cal-day other-month"><div className="cal-day-num">{daysInPrev - i}</div></div>);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr2 = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today2.getDate() === d && today2.getMonth() === calMonth && today2.getFullYear() === calYear;
    const dayEvents = CALENDAR_EVENTS.filter(e => e.date === dateStr2 && e.persons.includes(person));
    calCells.push(
      <div key={`day-${d}`} className={`cal-day ${isToday ? 'today' : ''}`}>
        <div className="cal-day-num">{d}</div>
        {dayEvents.map((e, ei) => <span key={ei} className={`cal-event-pip cal-event-${e.type}`} title={e.title}>{truncate(e.title, 12)}</span>)}
      </div>
    );
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calCells.push(<div key={`next-${i}`} className="cal-day other-month"><div className="cal-day-num">{i}</div></div>);
  }

  const upcomingCal = personEvents.slice(0, 8);
  const gcalSrc = GOOGLE_ACCOUNTS[person]?.calendarSrc;
  const gcalUrl = gcalSrc ? `https://calendar.google.com/calendar/embed?src=${gcalSrc}&ctz=America%2FLos_Angeles&mode=AGENDA&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&color=%23C25B38` : null;

  const sparkTitle = person === 'sunshine' ? '💡 Sparked Ideas' : person === 'monny' ? '💡 Sacral Downloads' : '💡 Distilled Insights';
  const hdRoleLine = hd ? `${p.name} · ${hd.type} ${hd.profile} · ${hd.authority} Authority` : `${p.name} · ${p.role}`;
  const flowReminder = firstSentence(p.energyReminder.text);

  // Action items filtered
  let filteredItems = personItems;
  if (filter === 'active') filteredItems = personItems.filter(i => i.status === 'todo' || i.status === 'in_progress');
  else if (filter !== 'all') filteredItems = personItems.filter(i => i.status === filter);

  // ── FLOW TAB ─────────────────────────────────────────
  function renderFlow() {
    return (
      <div className="person-tab-content">
        {/* Subtle HD type + date + roulette row */}
        <div className="flow-meta-row">
          <div className="flow-meta-left">
            <span className="flow-hd-line">{hdRoleLine}</span>
            <span className="flow-date-line">{dateStr}</span>
          </div>
          <button
            className="flow-mbody-btn"
            title="MBody / MonnyLog Roulette"
            onClick={() => { setShowMBodyModal(true); if (!mbodyResult) spinMBody(); }}
          >🎲</button>
        </div>

        {/* Check-in prompt */}
        <div className={`flow-checkin person-${person}-checkin`}>
          <span className="flow-checkin-q">{prompt}</span>
        </div>

        {/* HD Flow reminder — one line */}
        <div className="flow-hd-reminder">
          {flowReminder}
        </div>

        {/* Due Soon + Clarity Queue counts */}
        <div className="flow-counts-row">
          <button
            className="flow-count-item"
            onClick={() => switchTab('work')}
            title="View action items"
          >
            <span className="flow-count-num" style={{ color: dueSoon.length > 0 ? 'var(--cr8w-primary)' : 'var(--text-primary)' }}>{dueSoon.length}</span>
            <span className="flow-count-label">Due Soon</span>
          </button>
          <span className="flow-count-sep">·</span>
          <button
            className="flow-count-item"
            onClick={() => switchTab('work')}
            title="View clarity queue (blocked items)"
          >
            <span className="flow-count-num">{clarityQueue.length}</span>
            <span className="flow-count-label">Clarity Queue</span>
          </button>
          {dueSoon.length === 0 && clarityQueue.length === 0 && (
            <span className="flow-all-clear">All clear for now 🌿</span>
          )}
        </div>

        {/* Sparks — max 3 */}
        <div className="flow-section">
          <div className="flow-section-label">{sparkTitle}</div>
          <div className="spark-list">
            {personMomentum.length === 0 ? (
              <div className="flow-empty">Capture a spark below ✨</div>
            ) : personMomentum.slice(0, 3).map(m => (
              <div key={m.id} className="spark-item">
                {m.content}
                <div className="spark-item-time">{formatTimestamp(m.created_at)}</div>
              </div>
            ))}
          </div>
          <div className="spark-input-wrap">
            <input
              type="text"
              className="spark-input"
              placeholder="Capture a spark, download, or insight..."
              value={sparkInput}
              onChange={e => setSparkInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSpark(); }}
            />
            <button
              className="spark-btn"
              onClick={addSpark}
              style={{ '--person-color': p.color } as React.CSSProperties}
            >Spark ✨</button>
          </div>
        </div>

        {/* Coming Up — next 2 events */}
        <div className="flow-section">
          <div className="flow-section-title-row">
            <span className="flow-section-label">Coming Up</span>
            <button className="flow-see-all" onClick={() => switchTab('work')}>see all →</button>
          </div>
          {personEvents.length === 0 ? (
            <div className="flow-empty">No upcoming events</div>
          ) : personEvents.slice(0, 2).map((e, i) => (
            <div key={i} className="cal-preview-item">
              <span className="cal-preview-dot" style={{ background: getEventColor(e.type, p.color) }}></span>
              <span className="cal-preview-date">{formatEventDate(e.date)}</span>
              <span className="cal-preview-title">{e.title}{e.time ? ' · ' + e.time : ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── WORK TAB ─────────────────────────────────────────
  function renderWork() {
    return (
      <div className="person-tab-content">
        {/* GCal embed */}
        <div className="person-gcal-embed">
          {gcalUrl ? (
            <div className="gcal-embed-section">
              <div className="gcal-embed-header">
                <span>📅 {p.name}'s Google Calendar</span>
                <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="gcal-open-link">Open in Google Calendar →</a>
              </div>
              <iframe src={gcalUrl} className="calendar-iframe" frameBorder={0} title={`${p.name}'s Calendar`} />
            </div>
          ) : (
            <div className="gcal-embed-section gcal-embed-setup">
              <div className="gcal-setup-icon">📅</div>
              <div className="gcal-setup-text">
                <strong>{p.name}'s Calendar</strong><br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Calendar integration ready — sign into Google in this browser to view it here.</span>
              </div>
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="gcal-setup-btn">Open Google Calendar →</a>
            </div>
          )}
        </div>

        {/* Mini calendar */}
        <div className="calendar-container" style={{ marginTop: '24px' }}>
          <div className="calendar-header-bar">
            <button className="cal-nav-btn" onClick={() => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); }}>←</button>
            <h2 className="cal-month-title">{monthNames[calMonth]} {calYear}</h2>
            <button className="cal-nav-btn" onClick={() => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); }}>→</button>
          </div>
          <div className="calendar-grid">
            {dayHeaders.map(d => <div key={d} className="cal-day-header">{d}</div>)}
            {calCells}
          </div>
          <div className="upcoming-events">
            <h3 className="section-title" style={{ marginTop: '24px' }}>Upcoming Events</h3>
            {upcomingCal.map((e, i) => {
              const d = new Date(e.date + 'T00:00:00');
              return (
                <div key={i} className="event-card">
                  <div className="event-date-box">
                    <div className="event-date-month">{d.toLocaleString('en-US', { month: 'short' })}</div>
                    <div className="event-date-day">{d.getDate()}</div>
                  </div>
                  <div>
                    <div className="event-info-title">{e.title}</div>
                    <div className="event-info-detail">{e.time || ''}{e.location ? ' · ' + e.location : ''}</div>
                    <span className={`event-type-badge cal-event-${e.type}`}>{e.type.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
            {upcomingCal.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No upcoming events</div>}
          </div>
        </div>

        {/* Action Items */}
        <div style={{ marginTop: '32px' }}>
          <div className="actions-header">
            <h2 className="section-title" style={{ marginBottom: 0 }}>Action Items</h2>
            <button className="btn-add" onClick={onAddTask}>+ Add Item</button>
          </div>
          <div className="actions-filters">
            {[
              { key: 'active', label: 'Active' },
              { key: 'all', label: 'All' },
              { key: 'todo', label: 'To Do' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'done', label: 'Done' },
              { key: 'blocked', label: 'Blocked' }
            ].map(s => (
              <button key={s.key} className={`filter-btn ${filter === s.key ? 'active' : ''}`} onClick={() => setFilter(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="actions-list">
            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">
                  {filter === 'active' || filter === 'all'
                    ? 'Nothing queued — what\'s one thing you could move forward?'
                    : `No ${filter.replace('_', ' ')} items`}
                </div>
              </div>
            ) : filteredItems.map((item, idx) => (
              <div key={item.id} className={`action-row ${item.status === 'done' ? 'done-row' : ''} ${getDueClass(item.due_date, item.status)}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                <button
                  className={`action-status-btn status-${item.status}`}
                  onClick={() => {
                    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
                    onUpdateTaskStatus(item.id, next);
                  }}
                >
                  {item.status === 'done' ? '✓' : item.status === 'in_progress' ? '◐' : item.status === 'blocked' ? '✕' : ''}
                </button>
                <div className="action-info">
                  <div className="action-title">{item.title}</div>
                  <div className="action-meta">
                    <span><span className={`action-priority-dot dot-${item.priority}`}></span> {item.priority}</span>
                    {item.source && <span>📎 {item.source}</span>}
                    {item.due_date && <span className={`action-due-date ${getDueClass(item.due_date, item.status)}`} >📅 {formatDate(item.due_date)}</span>}
                    {item.category && <span>🏷 {item.category}</span>}
                  </div>
                </div>
                <select className="action-status-select" value={item.status} onChange={e => onUpdateTaskStatus(item.id, e.target.value as any)}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DEPTH TAB ─────────────────────────────────────────
  function renderDepth() {
    if (!hd) return <div className="person-tab-content"><p>No HD data available.</p></div>;

    const sections = [
      { id: 'type', icon: '⚡', title: `About ${hd.type}s`, content: hd.typeDescription },
      { id: 'strategy', icon: '🎯', title: 'Your Strategy', content: hd.strategyDetail },
      { id: 'authority', icon: '🧠', title: `${hd.authority} Authority`, content: hd.authorityDetail },
      { id: 'profile', icon: '🔮', title: `Profile ${hd.profile}: ${hd.profileName}`, isProfileLines: true },
      { id: 'definition', icon: '💫', title: `${hd.definition} Definition`, content: hd.definitionDetail },
      { id: 'centers', icon: '⭕', title: 'Energy Centers', isCenters: true },
      { id: 'practice', icon: '🌿', title: 'Living Your Design', isPractice: true }
    ];

    const doneCount = MILESTONES.filter(m => m.done).length;
    const progress = MILESTONES.length > 0 ? Math.round((doneCount / MILESTONES.length) * 100) : 0;

    return (
      <div className="person-tab-content">

        {/* HD Type Finder — collapsed by default */}
        <div className="depth-section">
          <div
            className={`depth-collapsible-header ${showHDCalc ? 'open' : ''}`}
            onClick={() => setShowHDCalc(!showHDCalc)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowHDCalc(!showHDCalc); }}
          >
            <span>🔍 HD Type Finder</span>
            <span className={`hd-acc-chevron ${showHDCalc ? 'rotate' : ''}`}>▼</span>
          </div>
          <div className={`depth-collapsible-body ${showHDCalc ? 'open' : ''}`}>
            <div className="hd-calculator-card">
              <p className="hd-calc-intro">Discover someone's Human Design type. Enter birth details to learn about energy type, strategy, and authority.</p>
              <div className="hd-calc-form">
                <div className="hd-calc-row">
                  <div className="hd-calc-field">
                    <label>Birth Date</label>
                    <input type="date" value={hdCalcDate} onChange={e => setHdCalcDate(e.target.value)} />
                  </div>
                  <div className="hd-calc-field">
                    <label>Birth Time (if known)</label>
                    <input type="time" value={hdCalcTime} onChange={e => setHdCalcTime(e.target.value)} />
                  </div>
                </div>
                <div className="hd-calc-row">
                  <div className="hd-calc-field">
                    <label>Birth City</label>
                    <input type="text" placeholder="e.g., Las Vegas, NV" />
                  </div>
                  <div className="hd-calc-field hd-calc-btn-wrap">
                    <button className="hd-calc-btn" onClick={calculateHD}>Discover Design ✨</button>
                  </div>
                </div>
              </div>
              {hdCalcResult && (
                <div className="hd-calc-result">
                  {hdCalcResult.error ? (
                    <p style={{ color: 'var(--cr8w-primary)', fontSize: '0.88rem' }}>{hdCalcResult.error}</p>
                  ) : (
                    <>
                      <div className="hd-calc-result-header">Your Human Design Overview</div>
                      <div className="hd-calc-result-grid">
                        {[
                          { label: 'Type', value: hdCalcResult.hdType },
                          { label: 'Profile', value: `${hdCalcResult.profile} ${profileNames[hdCalcResult.profile] || ''}` },
                          { label: 'Strategy', value: hdCalcResult.strategy },
                          { label: 'Authority', value: hdCalcResult.authority },
                          { label: 'Signature', value: hdCalcResult.signature, cls: 'hd-ov-positive' },
                          { label: 'Not-Self', value: hdCalcResult.notSelf, cls: 'hd-ov-caution' }
                        ].map((item, i) => (
                          <div key={i} className="hd-calc-result-item">
                            <span className="hd-cr-label">{item.label}</span>
                            <span className={`hd-cr-value ${item.cls || ''}`}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="hd-calc-result-desc">{hdCalcResult.desc}</div>
                    </>
                  )}
                </div>
              )}
              <p className="hd-calc-note">For a full chart reading with exact gates and channels, visit <a href="https://www.mybodygraph.com" target="_blank" rel="noopener noreferrer">mybodygraph.com</a>.</p>
            </div>
          </div>
        </div>

        {/* HD Profile */}
        <div className="hd-daily-prompt">
          <span className="hd-daily-icon">🔮</span>
          <div>
            <div className="hd-daily-label">Today's HD Prompt</div>
            <div className="hd-daily-text">{hdQuote}</div>
          </div>
        </div>
        <div className="hd-overview-card" style={{ borderTop: `3px solid ${p.color}` }}>
          <div className="hd-overview-header">
            <div className="hd-overview-type">{p.emoji} {hd.type}</div>
            <div className="hd-overview-profile">{hd.profile} {hd.profileName}</div>
          </div>
          <div className="hd-overview-grid">
            {[
              { label: 'Strategy', value: hd.strategy },
              { label: 'Authority', value: hd.authority },
              { label: 'Signature', value: hd.signature, cls: 'hd-ov-positive' },
              { label: 'Not-Self Theme', value: hd.notSelf, cls: 'hd-ov-caution' },
              { label: 'Definition', value: hd.definition },
              { label: 'Aura', value: hd.auraType }
            ].map((item, i) => (
              <div key={i} className="hd-overview-item">
                <span className="hd-ov-label">{item.label}</span>
                <span className={`hd-ov-value ${item.cls || ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hd-accordion">
          {sections.map(sec => (
            <div key={sec.id} className={`hd-accordion-item ${openAccordions.has(sec.id) ? 'open' : ''}`}>
              <button className="hd-accordion-header" onClick={() => toggleAccordion(sec.id)}>
                <span className="hd-acc-icon">{sec.icon}</span>
                <span className="hd-acc-title">{sec.title}</span>
                <span className="hd-acc-chevron">▼</span>
              </button>
              <div className="hd-accordion-body">
                {sec.isProfileLines && (
                  <div>
                    {Object.entries(hd.profileDetail).map(([key, text]) => (
                      <div key={key} className="hd-profile-line">
                        <div className="hd-profile-line-num">Line {key.replace('line', '')}</div>
                        <div>{text}</div>
                      </div>
                    ))}
                  </div>
                )}
                {sec.isCenters && (
                  <div className="hd-centers-wrap">
                    <div className="hd-centers-group">
                      <div className="hd-centers-group-title">Defined (Consistent Energy)</div>
                      <div className="hd-centers-list">
                        {hd.centers.defined.map(c => <span key={c} className="hd-center-pill hd-center-defined">{c}</span>)}
                      </div>
                    </div>
                    <div className="hd-centers-group">
                      <div className="hd-centers-group-title">Undefined (Open to Influence)</div>
                      <div className="hd-centers-list">
                        {hd.centers.undefined.map(c => <span key={c} className="hd-center-pill hd-center-undefined">{c}</span>)}
                      </div>
                    </div>
                    <p className="hd-centers-note">Defined centers = reliable, consistent energy. Undefined centers = where you absorb and amplify others' energy.</p>
                  </div>
                )}
                {sec.isPractice && (
                  <ul className="hd-practice-list">
                    {hd.livingYourDesign.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                )}
                {sec.content && <div>{sec.content}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* The Well */}
        <div style={{ marginTop: '32px' }}>
          {/* Titration Funnel */}
          <div className="well-section">
            <h3 className="well-section-title"><span className="section-icon">⛲️</span> The Titration Funnel</h3>
            <div className="funnel-visual">
              {[
                { icon: '☀️', bg: 'var(--sunshine-light)', name: 'Ideation', role: 'Sunshine · ManiGen', desc: 'Downloads, sparks, and visions pour in. Raw creative energy seeking form.' },
                null,
                { icon: '🌊', bg: 'var(--monny-light)', name: 'Bridging', role: 'Monny · Generator', desc: 'Embodied refinement. Testing with the sacral. Building structure around the spark.' },
                null,
                { icon: '✨', bg: 'var(--bingle-light)', name: 'Distilling', role: 'Bingle · Projector', desc: 'Seeing the essence. Naming the pattern. Crystallizing into shareable clarity.' },
                null,
                { icon: '🚀', bg: 'var(--sandstone)', name: 'Operationalize', role: 'Collective', desc: 'Ready for the world. Scheduled, planned, and launched.' }
              ].map((item, i) => item ? (
                <div key={i} className="funnel-stage">
                  <div className="funnel-stage-icon" style={{ background: item.bg }}>{item.icon}</div>
                  <div className="funnel-stage-name">{item.name}</div>
                  <div className="funnel-stage-role">{item.role}</div>
                  <div className="funnel-stage-desc">{item.desc}</div>
                </div>
              ) : <div key={i} className="funnel-arrow">→</div>)}
            </div>
          </div>

          {/* Milestones */}
          {MILESTONES.length > 0 && (
          <div className="well-section">
            <h3 className="well-section-title"><span className="section-icon">🚀</span> Hard Launch Milestones</h3>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600 }}>{doneCount} of {MILESTONES.length} complete</span>
                <span style={{ color: 'var(--text-muted)' }}>{progress}%</span>
              </div>
              <div className="launch-progress-bar"><div className="launch-progress-fill" style={{ width: `${progress}%` }}></div></div>
              <div className="milestones-grid">
                {MILESTONES.map((m, i) => (
                  <div key={i} className={`milestone-item ${m.done ? 'done-milestone' : ''}`}>
                    <div className={`milestone-check ${m.done ? 'done' : ''}`}>{m.done ? '✓' : ''}</div>
                    <span className="milestone-text">{m.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="stations-grid">
              {stationList.map(s => (
                <div key={s.id} className="station-card">
                  <div className="station-emoji">{s.emoji}</div>
                  <div className="station-name">{s.name}</div>
                  <div className="station-status">{s.status}</div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Glossary */}
          <div className="well-section">
            <h3 className="well-section-title"><span className="section-icon">📖</span> CR8W Glossary</h3>
            <div className="glossary-grid">
              {GLOSSARY.map((g, i) => (
                <div key={i} className="glossary-item">
                  <div className="glossary-term">{g.term}</div>
                  <div className="glossary-def">{g.def}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Forum */}
          <div className="well-section">
            <h3 className="well-section-title"><span className="section-icon">💬</span> The Well</h3>
            <div className="notes-area">
              <div className="note-input-wrap">
                <input
                  type="text"
                  className="note-input"
                  placeholder="Drop a thought, question, or note for the collective..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                />
                <button className="spark-btn" onClick={addNote}>Post</button>
              </div>
              {wellNotes.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '12px' }}>
                  Quiet queue — space for what's next
                </div>
              ) : wellNotes.map(n => {
                const np = PERSONS[n.author];
                const color = np ? np.color : 'var(--cr8w-primary)';
                return (
                  <div key={n.id} className="note-card">
                    <div className="note-author" style={{ color }}>{np ? np.emoji + ' ' : ''}{capitalize(n.author)}</div>
                    <div className="note-content">{n.content}</div>
                    <div className="note-time">{formatTimestamp(n.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`cr-view person-${person}`}>
      {/* Header */}
      <div className="person-header">
        <button className="back-btn" onClick={() => onNavigate('hub')}>← Hub</button>
        <div className="person-header-info">
          <span className="person-header-emoji">{p.emoji}</span>
          <div>
            <h1 className="person-header-name">{p.name}</h1>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              color: 'var(--text-muted)', fontWeight: 400, marginTop: 2,
            }}>
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return 'Good morning';
                if (hour < 17) return 'Good afternoon';
                return 'Good evening';
              })()}, {p.name} {p.emoji}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — 3 tabs */}
      <div className="person-tabs">
        {([
          { id: 'flow', label: 'Flow' },
          { id: 'work', label: 'Work' },
          { id: 'depth', label: 'Depth' }
        ] as { id: PersonTab; label: string }[]).map(t => (
          <button
            key={t.id}
            className={`person-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content with fade */}
      <div style={{ opacity: tabTransition ? 1 : 0, transition: 'opacity 0.15s ease' }}>
        {activeTab === 'flow' && renderFlow()}
        {activeTab === 'work' && renderWork()}
        {activeTab === 'depth' && renderDepth()}
      </div>

      {/* MBody Roulette Modal */}
      {showMBodyModal && (
        <div className="modal-overlay" onClick={() => setShowMBodyModal(false)}>
          <div className="modal mbody-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🧘 MBody / MonnyLog Roulette</h3>
              <button className="modal-close" onClick={() => setShowMBodyModal(false)}>×</button>
            </div>
            <div className="mbody-modal-body">
              {mbodySpinning ? (
                <div className="mbody-spinning">
                  <div className="mbody-spin-circle spinning"><span>🎲</span></div>
                  <div className="mbody-spin-label">Spinning...</div>
                </div>
              ) : mbodyResult ? (
                <div className="mbody-result">
                  <div className="mbody-result-category">{mbodyResult.category}</div>
                  <div className="mbody-result-title">{mbodyResult.title}</div>
                  <div className="mbody-result-desc">{mbodyResult.desc}</div>
                  <button className="mbody-respin-btn" onClick={spinMBody}>Spin Again 🎲</button>
                </div>
              ) : (
                <div className="mbody-spin-area" onClick={spinMBody}>
                  <div className="mbody-spin-circle"><span>🎲</span></div>
                  <div className="mbody-spin-label">Tap to spin</div>
                </div>
              )}
              <p className="hd-calc-note" style={{ marginTop: '16px' }}>🌱 Somatic exercises, journaling prompts, breathwork flows — curated by Monny.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}