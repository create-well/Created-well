import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

/* ─── Constants ─────────────────────────────────────────────── */
const TRACK_W = 240;
const TRACK_H = 40;
const THUMB_SIZE = 36;
const THUMB_TRAVEL = TRACK_W - THUMB_SIZE; // usable px range

const STOPS = [
  {
    idx: 0,
    key: 'quiet',
    emoji: '\uD83E\uDEE7',
    label: 'quiet mode',
    desc: 'anonymous mode, your notes are unsigned',
    color: '#A8C8D8',
  },
  {
    idx: 1,
    key: 'present',
    emoji: '\uD83C\uDF24\uFE0F',
    label: 'present',
    desc: 'first-name visible, you can react and be seen',
    color: '#F5DFC8',
  },
  {
    idx: 2,
    key: 'open',
    emoji: '\u2600\uFE0F',
    label: 'open',
    desc: 'fully visible, speak from the well, receive invites',
    color: '#E8C875',
  },
] as const;

function stopToX(idx: number) {
  return (idx / 2) * THUMB_TRAVEL;
}

function xToNearestStop(x: number) {
  const ratio = x / THUMB_TRAVEL;
  if (ratio < 0.25) return 0;
  if (ratio < 0.75) return 1;
  return 2;
}

/* ─── Component ─────────────────────────────────────────────── */
interface VisibilityDialProps {
  value: number;
  onChange: (idx: number) => void;
}

export function VisibilityDial({ value, onChange }: VisibilityDialProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(stopToX(value));
  const [dragging, setDragging] = useState(false);
  const [displayIdx, setDisplayIdx] = useState(value);

  // Sync display index as thumb moves
  useEffect(() => {
    const unsub = x.on('change', (latest) => {
      setDisplayIdx(xToNearestStop(latest));
    });
    return unsub;
  }, [x]);

  // External value change (e.g. from click)
  useEffect(() => {
    if (!dragging) {
      animate(x, stopToX(value), { type: 'spring', stiffness: 400, damping: 28 });
      setDisplayIdx(value);
    }
  }, [value, dragging, x]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
    const nearest = xToNearestStop(x.get());
    animate(x, stopToX(nearest), { type: 'spring', stiffness: 500, damping: 30 });
    setDisplayIdx(nearest);
    onChange(nearest);
  }, [x, onChange]);

  const handleStopClick = useCallback((idx: number) => {
    animate(x, stopToX(idx), { type: 'spring', stiffness: 500, damping: 30 });
    setDisplayIdx(idx);
    onChange(idx);
  }, [x, onChange]);

  const stop = STOPS[displayIdx];

  // Derive thumb border color from position for a smooth gradient feel
  const thumbBorder = useTransform(
    x,
    [0, THUMB_TRAVEL / 2, THUMB_TRAVEL],
    ['#A8C8D8', '#D4B896', '#E8C875'],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      {/* ─── Title ─── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: '0.92rem',
          color: 'var(--cr8w-text, #2D2438)',
          marginBottom: 2,
        }}>
          your dial {'\uD83C\uDF9A\uFE0F'}
        </div>
        <div style={{
          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
          fontSize: '0.64rem',
          color: 'var(--text-muted, #8A7B6B)',
          letterSpacing: '0.02em',
        }}>
          how visible do you want to be today?
        </div>
      </div>

      {/* ─── Description card ─── */}
      <motion.div
        key={stop.key}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          width: '100%',
          maxWidth: TRACK_W + 8,
          padding: '10px 14px',
          borderRadius: 12,
          background: `linear-gradient(135deg, ${stop.color}22, ${stop.color}11)`,
          border: `1px solid ${stop.color}44`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1.1rem', marginBottom: 3 }}>{stop.emoji}</div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#2D2438',
          marginBottom: 2,
          textTransform: 'lowercase',
        }}>
          {stop.label}
        </div>
        <div style={{
          fontFamily: "var(--font-label)",
          fontSize: '0.7rem',
          color: '#5A4E64',
          lineHeight: 1.4,
        }}>
          {stop.desc}
        </div>
      </motion.div>

      {/* ─── Track + Thumb ─── */}
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H,
          background: 'linear-gradient(90deg, #A8C8D8, #FFF4EC 50%, #E8C875)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          touchAction: 'none',
          flexShrink: 0,
        }}
        onClick={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = clickX / TRACK_W;
          const nearest = ratio < 0.33 ? 0 : ratio < 0.67 ? 1 : 2;
          handleStopClick(nearest);
        }}
      >
        {/* Notch markers */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: `${(i / 2) * THUMB_TRAVEL + THUMB_SIZE / 2}px`,
              transform: 'translate(-50%, -50%)',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Draggable thumb */}
        <motion.div
          style={{
            position: 'absolute',
            top: (TRACK_H - THUMB_SIZE) / 2,
            left: 0,
            x,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: '50%',
            background: '#FFFFFF',
            borderColor: thumbBorder,
            borderWidth: 2,
            borderStyle: 'solid',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            zIndex: 2,
            touchAction: 'none',
          }}
          drag="x"
          dragConstraints={{ left: 0, right: THUMB_TRAVEL }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragStart={() => setDragging(true)}
          onDragEnd={handleDragEnd}
          whileTap={{ scale: 1.08, cursor: 'grabbing' }}
        >
          {STOPS[displayIdx].emoji}
        </motion.div>
      </div>

      {/* ─── Stop labels ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: TRACK_W,
        padding: '0 2px',
        marginTop: -4,
      }}>
        {STOPS.map(s => (
          <button
            key={s.idx}
            onClick={() => handleStopClick(s.idx)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
              padding: '2px 6px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              fontFamily: "var(--font-label)",
              fontSize: '0.62rem',
              fontWeight: displayIdx === s.idx ? 700 : 400,
              color: displayIdx === s.idx ? '#2D2438' : 'var(--text-muted, #8A7B6B)',
              letterSpacing: '0.02em',
              transition: 'all 0.2s',
            }}>
              {s.label}
            </div>
            {displayIdx === s.idx && (
              <motion.div
                layoutId="dial-indicator"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: s.color,
                  margin: '3px auto 0',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}