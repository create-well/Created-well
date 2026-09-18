import React, { useState, useEffect, useMemo } from 'react';
import { WELL_GREETINGS } from './data';

const MOODS = [
  { key: 'flowing', emoji: '\uD83C\uDF0A', label: 'flowing', color: '#8BB5C4', response: 'good. let\u2019s keep it moving.' },
  { key: 'foggy', emoji: '\uD83C\uDF2B\uFE0F', label: 'foggy', color: '#B8A99A', response: 'that\u2019s okay. start soft.' },
  { key: 'fired', emoji: '\uD83D\uDD25', label: 'fired up', color: '#7BA89D', response: 'channel it. the well is ready.' },
] as const;

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export function ArriveState({ onDismiss }: { onDismiss: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const greeting = useMemo(() => WELL_GREETINGS[Math.floor(Math.random() * WELL_GREETINGS.length)], []);

  function handleSelect(key: string) {
    setSelected(key);
    localStorage.setItem('arriveState', key);
    localStorage.setItem('arriveState_ts', new Date().toISOString());
    setTimeout(() => {
      setClosing(true);
      setTimeout(onDismiss, 300);
    }, 1800);
  }

  function handleSkip() {
    localStorage.setItem('arriveState_ts', new Date().toISOString());
    setClosing(true);
    setTimeout(onDismiss, 300);
  }

  const selectedMood = MOODS.find(m => m.key === selected);

  return (
    <div className="arrive-state-card" style={{
      background: 'linear-gradient(135deg, #FFDEC2 0%, #FFF4EC 100%)',
      borderRadius: 18,
      padding: '28px 24px 20px',
      marginBottom: 4,
      transition: 'all 0.3s ease',
      opacity: closing ? 0 : 1,
      transform: closing ? 'translateY(-12px) scale(0.97)' : 'translateY(0) scale(1)',
      maxHeight: closing ? 0 : 320,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(123,168,157,0.08)',
    }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: '1.15rem',
        color: 'var(--cr8w-text, #2C1C10)',
        marginBottom: 18,
        textAlign: 'center',
        fontWeight: 400,
        lineHeight: 1.4,
      }}>
        {selected && selectedMood
          ? selectedMood.response
          : greeting}
      </div>

      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {MOODS.map(m => {
          const isActive = selected === m.key;
          return (
            <button
              key={m.key}
              onClick={() => !selected && handleSelect(m.key)}
              style={{
                padding: '8px 18px',
                borderRadius: 24,
                border: isActive ? `2px solid ${m.color}` : '1.5px solid rgba(44,28,16,0.12)',
                background: isActive ? `${m.color}20` : 'rgba(255,255,255,0.6)',
                color: isActive ? m.color : '#2C1C10',
                fontFamily: "var(--font-label)",
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                cursor: selected ? 'default' : 'pointer',
                transition: 'all 0.2s',
                opacity: selected && !isActive ? 0.4 : 1,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {m.emoji} {m.label}
            </button>
          );
        })}
      </div>

      {!selected && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(44,28,16,0.4)',
              fontFamily: "var(--font-label)",
              fontSize: '0.72rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              letterSpacing: '0.02em',
            }}
          >skip</button>
        </div>
      )}
    </div>
  );
}

/** Check if we should show the arrive state (once per day) */
export function shouldShowArriveState(): boolean {
  const ts = localStorage.getItem('arriveState_ts');
  if (!ts) return true;
  try {
    return !isSameDay(new Date(ts), new Date());
  } catch { return true; }
}