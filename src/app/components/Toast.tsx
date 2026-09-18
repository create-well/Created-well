import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Types ─── */
export type ToastVariant = 'default' | 'well' | 'alert';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

/* ─── Variant styles ─── */
const VARIANT_BG: Record<ToastVariant, string> = {
  default: '#2D2438',
  well: '#7BA89D',
  alert: '#B8A9D4',
};

/* ─── Global queue / event bus ─── */
type Listener = (item: ToastItem) => void;
let _nextId = 0;
const _listeners: Set<Listener> = new Set();

/**
 * Global function — call from anywhere to show a toast.
 * ```
 * import { showToast } from './components/Toast';
 * showToast('saved!', 'well');
 * ```
 */
export function showToast(message: string, variant: ToastVariant = 'default') {
  const item: ToastItem = { id: ++_nextId, message, variant };
  _listeners.forEach(fn => fn(item));
}

/* ─── React component (mount once at app root) ─── */
const HOLD_MS = 2000;
const FADE_IN_MS = 250;
const FADE_OUT_MS = 300;
const GAP_MS = 500;

export function ToastContainer() {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'idle'>('idle');
  const queueRef = useRef<ToastItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* Process next item in queue */
  const processNext = useCallback(() => {
    clearTimer();
    if (queueRef.current.length === 0) {
      setCurrent(null);
      setPhase('idle');
      return;
    }
    const next = queueRef.current.shift()!;
    setCurrent(next);
    setPhase('in');

    // After fade-in, hold
    timerRef.current = setTimeout(() => {
      setPhase('hold');
      // After hold, fade out
      timerRef.current = setTimeout(() => {
        setPhase('out');
        // After fade-out, gap then next
        timerRef.current = setTimeout(() => {
          processNext();
        }, FADE_OUT_MS + GAP_MS);
      }, HOLD_MS);
    }, FADE_IN_MS);
  }, [clearTimer]);

  /* Dismiss immediately */
  const dismiss = useCallback(() => {
    clearTimer();
    setPhase('out');
    timerRef.current = setTimeout(() => {
      processNext();
    }, FADE_OUT_MS + GAP_MS);
  }, [clearTimer, processNext]);

  /* Subscribe to global showToast calls */
  useEffect(() => {
    const handler: Listener = (item) => {
      queueRef.current.push(item);
      // If idle, kick off processing
      if (queueRef.current.length === 1 && (phase === 'idle' || !current)) {
        processNext();
      }
    };
    _listeners.add(handler);
    return () => { _listeners.delete(handler); clearTimer(); };
  }, [phase, current, processNext, clearTimer]);

  if (!current || phase === 'idle') return null;

  const isVisible = phase === 'in' || phase === 'hold';
  const bg = VARIANT_BG[current.variant];

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0px' : '20px'})`,
        opacity: isVisible ? 1 : 0,
        zIndex: 9999,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: isVisible
          ? `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`
          : `opacity ${FADE_OUT_MS}ms ease-in, transform ${FADE_OUT_MS}ms ease-in`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: bg,
          color: '#fff',
          fontFamily: "var(--font-label)",
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          borderRadius: 24,
          padding: '10px 20px',
          maxWidth: 320,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {current.message}
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.65)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '14px',
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}