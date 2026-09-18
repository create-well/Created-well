import React, { useState, useCallback } from 'react';
import type { WellNote } from './api';
import { showToast } from './Toast';

const SEED_NOTES = [
  "you don\u2019t have to finish it today. you just have to touch it.",
  "the project you keep avoiding? it\u2019s not resistance. it\u2019s respect. you know it deserves your full attention.",
  "rest is not the reward for creating. rest is the soil.",
  "your creative block isn\u2019t a wall. it\u2019s a door you haven\u2019t found the handle for yet.",
  "somebody in this community is doing the exact thing you\u2019re scared to start. reach out.",
  "the version of you that stopped creating didn\u2019t die. they\u2019re just sleeping. wake them up gently.",
  "you are not behind.",
  "what if the mess IS the masterpiece right now?",
  "creating is not content. creating is conversation.",
  "the well is deep. take what you need. leave what you can.",
];

interface Props {
  wellNotes: WellNote[];
  onAddNote: (content: string) => void;
  onLandNote: (id: number) => void;
}

export function NotesFromTheWell({ wellNotes, onAddNote, onLandNote }: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Titration Dial: read visibility from localStorage
  const visibilityDial = (() => {
    const stored = localStorage.getItem('visibilityDial');
    return stored ? parseInt(stored) : 1;
  })();
  const isQuiet = visibilityDial === 0;

  // Combine seed notes with user-submitted notes for The Spring
  const allNotes = [
    ...SEED_NOTES.map((content, i) => ({ id: -(i + 1), content, landed: 0 })),
    ...wellNotes,
  ];
  const [springIdx, setSpringIdx] = useState(() => Math.floor(Math.random() * allNotes.length));
  const currentNote = allNotes[springIdx % allNotes.length] || allNotes[0];
  const [localLanded, setLocalLanded] = useState(false);

  const pullAnother = useCallback(() => {
    let next = Math.floor(Math.random() * allNotes.length);
    if (allNotes.length > 1) while (next === springIdx % allNotes.length) next = Math.floor(Math.random() * allNotes.length);
    setSpringIdx(next);
    setLocalLanded(false);
  }, [allNotes.length, springIdx]);

  function handleSubmit() {
    if (!input.trim()) return;
    onAddNote(input.trim());
    setInput('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3500);
    showToast('\uD83D\uDCA7 it\u2019s in the well now.', 'well');
  }

  function handleLanded() {
    if (currentNote.id > 0) onLandNote(currentNote.id);
    setLocalLanded(true);
    showToast('\uD83C\uDF31 +1', 'well');
  }

  return (
    <div className="hub-section-sm">
      <div className="hub-section-header">
        <span className="hub-section-title" style={{ fontFamily: "var(--font-display)", textTransform: 'none', fontSize: '0.95rem', fontWeight: 500, color: 'var(--cr8w-text, #2C1C10)' }}>
          💧 notes from the well
        </span>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {/* The Well — input */}
        <div style={{
          background: '#FFF4EC',
          border: '1.5px solid rgba(123,168,157,0.12)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--cr8w-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            the well
          </div>
          {isQuiet && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 600,
              color: '#8BB5C4', letterSpacing: '0.02em',
              background: 'rgba(139,181,196,0.08)',
              borderRadius: 8, padding: '4px 10px',
            }}>
              🫧 quiet mode active — notes are always anonymous
            </div>
          )}
          {visibilityDial === 2 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 600,
              color: '#7BA89D', letterSpacing: '0.02em',
              background: 'rgba(123,168,157,0.06)',
              borderRadius: 8, padding: '4px 10px',
            }}>
              🔥 open mode — your words carry warmth
            </div>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="drop something in the well... a thought, a question, permission you need to hear"
            className="well-note-textarea"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: '0.88rem',
              color: '#2C1C10',
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(123,168,157,0.15)',
              borderRadius: 10,
              padding: '10px 12px',
              minHeight: 80,
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          {submitted ? (
            <div style={{
              fontFamily: "var(--font-label)",
              fontSize: '0.82rem',
              color: '#8BB5C4',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '6px 0',
            }}>
              it's in the well now. someone will find it when they need it. \uD83D\uDCA7
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="well-note-submit-btn"
              style={{
                alignSelf: 'flex-start',
                padding: '7px 16px',
                borderRadius: 10,
                border: 'none',
                background: input.trim() ? 'var(--cr8w-primary)' : 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.3)',
                color: '#fff',
                fontFamily: 'var(--font-label)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s',
                letterSpacing: '0.03em',
              }}
            >drop it in \uD83D\uDCA7</button>
          )}
        </div>

        {/* The Spring — random note display */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-soft)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: '#8BB5C4', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            the spring
          </div>
          <div style={{
            fontFamily: "var(--font-label)",
            fontSize: '1rem',
            color: 'var(--text-primary)',
            fontStyle: 'italic',
            lineHeight: 1.55,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            <span>&ldquo;{currentNote?.content}&rdquo;</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleLanded}
              disabled={localLanded}
              className="well-note-landed-btn"
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: localLanded ? '1px solid rgba(48,209,88,0.3)' : '1px solid rgba(139,181,196,0.3)',
                background: localLanded ? 'rgba(48,209,88,0.08)' : 'rgba(139,181,196,0.08)',
                color: localLanded ? '#30D158' : '#8BB5C4',
                fontFamily: 'var(--font-label)',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: localLanded ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >{localLanded ? '\u2705 landed' : '\uD83C\uDF31 this landed'}</button>
            {/* Landed count — community resonance indicator */}
            {(() => {
              const landedCount = (currentNote?.landed || 0) + (localLanded && currentNote?.id && currentNote.id < 0 ? 0 : localLanded ? 1 : 0);
              // For user-submitted notes (id > 0), show the real landed count
              // For seed notes (id < 0), only show if user just landed
              if (currentNote?.id > 0 && landedCount > 0) {
                return (
                  <span style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: landedCount >= 5 ? '#D4A771' : 'var(--text-muted)',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    {landedCount >= 5 ? '🌟' : '🌱'} {landedCount} {landedCount === 1 ? 'soul' : 'souls'} felt this
                  </span>
                );
              }
              return null;
            })()}
            <button
              onClick={pullAnother}
              className="well-note-pull-btn"
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: '1px solid var(--border-soft)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >pull another</button>
          </div>
        </div>
      </div>
    </div>
  );
}