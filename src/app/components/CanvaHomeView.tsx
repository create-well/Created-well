import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PERSONS } from './data';
import type { Announcement, BrainDump } from './data';
import type { Task, Station, WellNote, Workshop, CoFlowDate, CoFlowCheckin } from './api';

interface CanvaHomeViewProps {
  onNavigate: (view: string) => void;
  announcements: Announcement[];
  brainDumps: BrainDump[];
  onAddBrainDump: (dump: Omit<BrainDump, 'id' | 'created_at'>) => void;
  syncTime: string;
  activeUser?: string;
  wellNotes: WellNote[];
  onAddWellNote: (content: string) => Promise<void>;
  onLandWellNote: (id: number) => void;
  workshops?: Workshop[];
  coFlowDates?: CoFlowDate[];
  coFlowCheckins?: CoFlowCheckin[];
  actionItems?: Task[];
  stations?: Station[];
}

const TEAM = [
  { key: 'sunshine', role: 'flow keeper', note: 'holds the why', color: '#D4A5A5' },
  { key: 'bingle', role: 'closer', note: 'distills the current', color: '#D4A574' },
  { key: 'monny', role: 'benediction', note: 'bridges the body', color: '#A9D6F8' },
  { key: 'omar', role: 'tech anchor', note: 'keeps the fire live', color: '#9B7FD4' },
] as const;

export function CanvaHomeView({
  onNavigate,
  announcements,
  brainDumps,
  onAddBrainDump,
  syncTime,
  activeUser = 'monny',
  wellNotes,
  onAddWellNote,
  onLandWellNote,
  workshops = [],
  coFlowDates = [],
  coFlowCheckins = [],
  actionItems = [],
  stations = [],
}: CanvaHomeViewProps) {
  const navigate = useNavigate();
  const [arrival, setArrival] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [noteError, setNoteError] = useState('');

  const person = PERSONS[activeUser] ?? PERSONS.monny;
  const openTasks = actionItems.filter(task => task.status !== 'done' && task.status !== 'completed');
  const latestNote = wellNotes[0];
  const nextWorkshop = workshops[0];
  const nextCoFlow = coFlowDates[0];
  const nextTask = openTasks[0];
  const syncLabel = syncTime ? syncTime.replace(/^Synced /, '') : 'waiting for first sync';

  const weekLabel = useMemo(() => new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  }).format(new Date()), []);

  async function addNote() {
    const content = note.trim();
    if (!content || noteState === 'saving') return;
    setNoteState('saving');
    setNoteError('');
    try {
      await onAddWellNote(content);
      setNote('');
      setNoteState('saved');
    } catch (_) {
      setNoteState('error');
      setNoteError('The note stayed with you. Try again when the current is clear.');
    }
  }

  function addDump() {
    const content = note.trim();
    if (!content) return;
    onAddBrainDump({ author: activeUser, content, tags: [], drive_link: undefined });
    setNote('');
    setShowBrainDump(false);
  }

  return (
    <div className="cw-v2-page cr-view">
      <section className="cw-v2-arrival" aria-label="Arrival check-in">
        <div className="cw-v2-eyebrow">✣ before you drop in</div>
        <p>Is anything you’re carrying not yours?</p>
        <div className="cw-v2-pills">
          {['I’m clear — this is mine', 'The room feels heavy', 'Not sure — need a minute'].map(option => (
            <button key={option} className={arrival === option ? 'is-selected' : ''} onClick={() => setArrival(option)}>
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="cw-v2-mood" aria-label="Mood check-in">
        <h1>well aware you’d be back.</h1>
        <div className="cw-v2-mood-row">
          {[
            ['🌊', 'flowing'], ['🌫️', 'foggy'], ['🔥', 'fired up'],
          ].map(([icon, label]) => (
            <button key={label} className={mood === label ? 'is-selected' : ''} onClick={() => setMood(label)}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
        <button className="cw-v2-skip" onClick={() => setMood(null)}>skip</button>
      </section>

      <header className="cw-v2-welcome">
        <div className="cw-v2-avatar" style={{ background: person.color }}>{person.emoji}</div>
        <div>
          <h2>Good morning, {person.name}</h2>
          <div className="cw-v2-meta">{weekLabel} <button onClick={() => navigator.clipboard?.writeText(window.location.href)}>↗ share link</button></div>
        </div>
        <div className="cw-v2-sync"><span className="cw-v2-sync-dot" /> {syncLabel}</div>
      </header>

      <section className="cw-v2-card cw-v2-drop">
        <div className="cw-v2-section-head">
          <div><div className="cw-v2-eyebrow rust">this week’s drop</div><h3>Episode 4 · recording current</h3></div>
          <button className="cw-v2-text-link" onClick={() => onNavigate('geyser')}>open Geyser →</button>
        </div>
        <div className="cw-v2-team-grid">
          {TEAM.map(member => {
            const memberData = PERSONS[member.key];
            return (
              <button key={member.key} className="cw-v2-team-card" onClick={() => navigate(`/moves?person=${member.key}`)} style={{ '--team-color': member.color } as React.CSSProperties}>
                <span className="cw-v2-label">{member.role}</span>
                <span className="cw-v2-team-avatar">{memberData.emoji}</span>
                <strong>{memberData.name}</strong>
                <em>{member.note}</em>
              </button>
            );
          })}
        </div>
      </section>

      <div className="cw-v2-grid">
        <section className="cw-v2-card cw-v2-current">
          <div className="cw-v2-section-head"><div><div className="cw-v2-eyebrow">current in the water</div><h3>What’s moving now</h3></div><span className="cw-v2-count">{openTasks.length}</span></div>
          {nextTask ? <button className="cw-v2-list-row" onClick={() => onNavigate('geyser')}><span className="cw-v2-status-dot" /> <span>{nextTask.title}</span><b>→</b></button> : <p className="cw-v2-empty">The current is quiet. A clean slate is still a signal.</p>}
          {stations.length > 0 && <button className="cw-v2-list-row" onClick={() => onNavigate('geyser')}><span className="cw-v2-status-dot sage" /> <span>{stations.length} activation stations in view</span><b>→</b></button>}
          <button className="cw-v2-footer-link" onClick={() => onNavigate('geyser')}>see all Moves →</button>
        </section>

        <section className="cw-v2-card cw-v2-next">
          <div className="cw-v2-section-head"><div><div className="cw-v2-eyebrow">next ripple</div><h3>Where the flow goes</h3></div><span className="cw-v2-wave">〰</span></div>
          <div className="cw-v2-next-item"><span>🗓</span><div><strong>{nextCoFlow ? 'Co-Flow date' : nextWorkshop ? nextWorkshop.title : 'Next shared touchpoint'}</strong><small>{nextCoFlow ? 'held for the collective' : nextWorkshop ? nextWorkshop.description : 'nothing scheduled yet'}</small></div></div>
          <button className="cw-v2-footer-link" onClick={() => onNavigate(nextCoFlow ? 'coflow' : 'workshops')}>follow the ripple →</button>
        </section>
      </div>

      <section className="cw-v2-card cw-v2-care">
        <div className="cw-v2-care-copy"><div className="cw-v2-eyebrow">care loop</div><h3>Leave a note in the well</h3><p>One honest sentence is enough. It can be landed later.</p></div>
        <div className="cw-v2-care-action">
          <textarea
            value={note}
            onChange={event => { setNote(event.target.value); if (noteState !== 'idle') setNoteState('idle'); setNoteError(''); }}
            placeholder="What’s present?"
            rows={2}
            aria-label="Add a note to the well"
            aria-describedby="cw-v2-care-status"
            disabled={noteState === 'saving'}
          />
          <div className="cw-v2-care-controls">
            <button className="cw-v2-secondary" onClick={() => setShowBrainDump(!showBrainDump)} disabled={noteState === 'saving'}>brain dump</button>
            <button className="cw-v2-primary" onClick={showBrainDump ? addDump : addNote} disabled={noteState === 'saving' || !note.trim()}>
              {noteState === 'saving' ? 'holding…' : showBrainDump ? 'drop the thought' : noteState === 'saved' ? 'landed ✓' : 'let it flow'}
            </button>
          </div>
          <div id="cw-v2-care-status" className={`cw-v2-care-status ${noteState}`} role="status" aria-live="polite">
            {noteState === 'saving' && 'Making room for this note…'}
            {noteState === 'saved' && 'Your note is in the well.'}
            {noteState === 'error' && noteError}
          </div>
        </div>
      </section>

      <section className="cw-v2-card cw-v2-notes">
        <div className="cw-v2-section-head"><div><div className="cw-v2-eyebrow">from the well</div><h3>Recent currents</h3></div><button className="cw-v2-text-link" onClick={() => onNavigate('care')}>open Care Loop →</button></div>
        {latestNote ? <div className="cw-v2-quote"><span>“</span><p>{latestNote.content}</p><button onClick={() => onLandWellNote(latestNote.id)}>landed</button></div> : brainDumps[0] ? <div className="cw-v2-quote"><span>“</span><p>{brainDumps[0].content}</p></div> : announcements[0] ? <div className="cw-v2-quote"><span>“</span><p>{announcements[0].content}</p></div> : <p className="cw-v2-empty">No note is asking for your attention yet.</p>}
      </section>

      <footer className="cw-v2-footer"><span>flowing &gt; forcing</span><span>•</span><span>create well collective</span><span>•</span><span>sync {syncLabel}</span></footer>
    </div>
  );
}
