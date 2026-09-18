import React, { useState, useEffect, useCallback } from 'react';

/* ─── Constants ─── */
const PRIMARY = '#7BA89D';
const PRIMARY_DIM = 'rgba(123,168,157,0.35)';
const TRACK_OFF = 'rgba(45,36,56,0.18)';
const TEXT_MAIN = '#2D2438';

const TOGGLE_W = 40;
const TOGGLE_H = 22;
const KNOB = 16;

function isMobile(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/* ─── Individual toggle ─── */
function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{
        position: 'relative',
        width: TOGGLE_W,
        height: TOGGLE_H,
        borderRadius: TOGGLE_H,
        border: 'none',
        background: on ? PRIMARY : TRACK_OFF,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.25s',
        boxShadow: on
          ? `inset 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px ${PRIMARY}22`
          : 'inset 0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: (TOGGLE_H - KNOB) / 2,
          left: on ? TOGGLE_W - KNOB - (TOGGLE_H - KNOB) / 2 : (TOGGLE_H - KNOB) / 2,
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.25s cubic-bezier(.4,.2,.2,1)',
        }}
      />
    </button>
  );
}

/* ─── Row component ─── */
function SettingRow({
  emoji,
  label,
  sublabel,
  on,
  onToggle,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: '0.8rem',
            color: TEXT_MAIN,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: '0.62rem',
            color: 'var(--text-muted, #8A7B6B)',
            lineHeight: 1.3,
          }}
        >
          {sublabel}
        </div>
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

/* ─── Main component ─── */
export function SensorySettings() {
  const [sound, setSound] = useState<boolean>(() => {
    const stored = localStorage.getItem('cw_sound');
    return stored !== null ? stored === 'true' : true;
  });

  const [haptic, setHaptic] = useState<boolean>(() => {
    const stored = localStorage.getItem('cw_haptic');
    return stored !== null ? stored === 'true' : isMobile();
  });

  const [motion, setMotion] = useState<boolean>(() => {
    const stored = localStorage.getItem('cw_motion');
    if (stored !== null) return stored === 'true';
    return !prefersReducedMotion();
  });

  // Apply/remove global no-animation class
  const applyMotionClass = useCallback((enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.remove('cw-no-motion');
    } else {
      document.documentElement.classList.add('cw-no-motion');
    }
  }, []);

  // On mount, set initial motion state
  useEffect(() => {
    applyMotionClass(motion);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to OS prefers-reduced-motion changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-update if user hasn't explicitly overridden
      const stored = localStorage.getItem('cw_motion');
      if (stored === null) {
        const newVal = !e.matches;
        setMotion(newVal);
        applyMotionClass(newVal);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyMotionClass]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem('cw_sound', String(next));
    window.dispatchEvent(new StorageEvent('storage', { key: 'cw_sound', newValue: String(next) }));
  }

  function toggleHaptic() {
    const next = !haptic;
    setHaptic(next);
    localStorage.setItem('cw_haptic', String(next));
    window.dispatchEvent(new StorageEvent('storage', { key: 'cw_haptic', newValue: String(next) }));
  }

  function toggleMotion() {
    const next = !motion;
    setMotion(next);
    localStorage.setItem('cw_motion', String(next));
    applyMotionClass(next);
    window.dispatchEvent(new StorageEvent('storage', { key: 'cw_motion', newValue: String(next) }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Section title */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: '0.88rem',
            color: TEXT_MAIN,
            marginBottom: 1,
          }}
        >
          sensory settings {'\uD83C\uDFB6'}
        </div>
      </div>

      <SettingRow
        emoji={'\uD83D\uDD0A'}
        label="sounds"
        sublabel="button taps, seals, ambient cues"
        on={sound}
        onToggle={toggleSound}
      />

      <SettingRow
        emoji={'\uD83D\uDCF3'}
        label="haptics"
        sublabel="gentle vibrations on mobile"
        on={haptic}
        onToggle={toggleHaptic}
      />

      <SettingRow
        emoji={'\u2728'}
        label="motion"
        sublabel="animations, transitions, spring physics"
        on={motion}
        onToggle={toggleMotion}
      />

      {/* Footer text */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 10,
          fontFamily: "var(--font-label)",
          fontSize: '0.68rem',
          fontStyle: 'italic',
          color: TEXT_MAIN,
          opacity: 0.4,
        }}
      >
        your well, your way.
      </div>
    </div>
  );
}