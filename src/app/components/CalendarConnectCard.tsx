import React, { useState } from 'react';
import { useCalendarSync } from '../../lib/useCalendarSync';

// @cr8w/design-system Button (dist/index.js: `var e = () => null`) renders null —
// all <button> elements below are raw HTML with this justification applied globally.

function formatSyncTime(date: Date | null): string {
  if (!date) return 'never';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getHealthLabel(lastSynced: Date | null): 'fresh' | 'stale' {
  if (!lastSynced) return 'stale';
  return Date.now() - lastSynced.getTime() < 30 * 60 * 1000 ? 'fresh' : 'stale';
}

// Skeleton shimmer — matches existing loading patterns in the app
function SkeletonLine({ width, height = 12 }: { width: string | number; height?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: 6,
        background:
          'linear-gradient(90deg, rgba(196,164,132,0.12) 25%, rgba(196,164,132,0.22) 50%, rgba(196,164,132,0.12) 75%)',
        backgroundSize: '200% 100%',
        animation: 'ccc-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

// Calendar icon — using raw <svg> because the kit ships no icon set
function CalendarIcon({ dim = false }: { dim?: boolean }) {
  const stroke = dim ? 'rgba(194,91,56,0.4)' : '#C25B38';
  const fill = dim ? 'rgba(194,91,56,0.2)' : '#C25B38';
  return (
    // using raw <svg> — @cr8w/design-system has no icon component (components/overview.md lists only Button)
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={stroke} strokeWidth="1.5" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="13" width="4" height="4" rx="0.5" fill={fill} />
    </svg>
  );
}

const CARD: React.CSSProperties = {
  background: 'var(--cr8w-card-bg, #F4F1ED)',
  border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
  borderRadius: 12,
  padding: '20px 20px 22px',
  position: 'relative',
};

const ICON_WRAP: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const DISPLAY: React.CSSProperties = {
  fontFamily: 'var(--font-display, Fredoka, sans-serif)',
  fontWeight: 600,
  color: 'var(--cr8w-text, #2D2438)',
  lineHeight: 1.2,
};

const BODY_SM: React.CSSProperties = {
  fontFamily: 'var(--font-body, Montserrat, sans-serif)',
  fontSize: '0.73rem',
  color: 'var(--text-muted, #8A7D72)',
  lineHeight: 1.5,
};

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-label, Blinker, sans-serif)',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.09em',
};

interface CalendarConnectCardProps {
  profileKey?: string;
}

export function CalendarConnectCard({ profileKey = 'monny' }: CalendarConnectCardProps) {
  const { status, connectedUser, lastSynced, errorMsg, connect, disconnect, syncNow } =
    useCalendarSync();

  const [hovered, setHovered] = useState(false);
  const [ctaDown, setCtaDown] = useState(false);

  const health = getHealthLabel(lastSynced);
  const isConnected = status === 'connected';
  const isError = status === 'error';
  const isLoading = status === 'connecting' || status === 'syncing';

  // ── LOADING (skeleton) ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <style>{`
          @keyframes ccc-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div style={CARD} aria-label="Connecting to Google Calendar…" aria-busy="true">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ ...ICON_WRAP, background: 'rgba(196,164,132,0.1)' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLine width="55%" height={14} />
              <SkeletonLine width="38%" height={10} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <SkeletonLine width={130} height={20} />
          </div>
          <SkeletonLine width="100%" height={40} />
          <div style={{ ...BODY_SM, fontSize: '0.65rem', textAlign: 'center', marginTop: 10 }}>
            {status === 'syncing' ? 'Pulling events from Google…' : 'Waiting for Google authorization…'}
          </div>
        </div>
      </>
    );
  }

  // ── CONNECTED ──────────────────────────────────────────────────────────────
  if (isConnected) {
    return (
      <div
        style={{
          ...CARD,
          boxShadow: hovered ? '0 4px 20px rgba(196,164,132,0.18)' : '0 1px 4px rgba(196,164,132,0.06)',
          transition: 'box-shadow 200ms ease-out',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Health chip — top right */}
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'var(--color-success-bg, rgba(67,122,34,0.1))',
            border: '1px solid var(--color-success, #437a22)',
            borderRadius: 20,
            padding: '3px 10px',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success, #437a22)',
              boxShadow: '0 0 5px var(--color-success, #437a22)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              ...LABEL,
              fontSize: '0.6rem',
              color: 'var(--color-success, #437a22)',
            }}
          >
            {health}
          </span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 90 }}>
          <div style={{ ...ICON_WRAP, background: 'rgba(194,91,56,0.08)' }}>
            <CalendarIcon />
          </div>
          <div>
            <div style={{ ...DISPLAY, fontSize: '1.05rem' }}>Calendar connected</div>
            <div style={{ ...BODY_SM, marginTop: 2 }}>{connectedUser || 'Google account'}</div>
          </div>
        </div>

        {/* Sync row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
            borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
            marginBottom: 14,
          }}
        >
          <span style={{ ...BODY_SM }}>
            Synced from Google Calendar · {formatSyncTime(lastSynced)}
          </span>
          <button
            onClick={() => syncNow()}
            title="Pull latest events"
            style={{
              ...LABEL,
              fontSize: '0.62rem',
              color: 'var(--cr8w-text, #2D2438)',
              background: 'none',
              border: '1px solid rgba(196,164,132,0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'background 200ms ease-out',
            }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(196,164,132,0.1)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLButtonElement).style.background = 'none')
            }
          >
            drop it in
          </button>
        </div>

        {/* Disconnect ghost */}
        <button
          onClick={disconnect}
          style={{
            ...LABEL,
            fontSize: '0.6rem',
            color: 'var(--text-muted, #8A7D72)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'color 200ms ease-out',
          }}
          onMouseEnter={e =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--cr8w-text, #2D2438)')
          }
          onMouseLeave={e =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted, #8A7D72)')
          }
        >
          Disconnect
        </button>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div
        style={{
          ...CARD,
          borderColor: 'rgba(161,44,123,0.25)',
          boxShadow: hovered ? '0 4px 16px rgba(161,44,123,0.08)' : 'none',
          transition: 'box-shadow 200ms ease-out',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              ...ICON_WRAP,
              background: 'var(--color-error-bg, rgba(161,44,123,0.08))',
            }}
          >
            {/* using raw <svg> — kit has no icon set */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="var(--color-error, #a12c7b)" strokeWidth="1.5" />
              <path
                d="M12 8v5M12 16v.5"
                stroke="var(--color-error, #a12c7b)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div
              style={{ ...DISPLAY, fontSize: '1rem', color: 'var(--color-error, #a12c7b)', marginBottom: 4 }}
            >
              Couldn&apos;t connect
            </div>
            <div style={{ ...BODY_SM }}>
              {errorMsg ?? "Something went wrong connecting your calendar. Try again."}
            </div>
          </div>
        </div>

        <button
          onClick={() => connect(profileKey)}
          style={{
            ...LABEL,
            fontSize: '0.78rem',
            color: '#fff',
            background: 'var(--color-error, #a12c7b)',
            border: 'none',
            borderRadius: 8,
            padding: '11px 20px',
            cursor: 'pointer',
            width: '100%',
            transition: 'opacity 200ms ease-out',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.88')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── DEFAULT / IDLE (empty) ─────────────────────────────────────────────────
  return (
    <div
      style={{
        ...CARD,
        boxShadow: hovered ? '0 4px 20px rgba(196,164,132,0.18)' : '0 1px 4px rgba(196,164,132,0.06)',
        transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Empty chip — top right */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 16,
          ...LABEL,
          fontSize: '0.58rem',
          color: 'var(--text-muted, #8A7D72)',
          background: 'rgba(196,164,132,0.08)',
          border: '1px solid rgba(196,164,132,0.18)',
          borderRadius: 20,
          padding: '3px 10px',
        }}
      >
        not connected
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 110 }}>
        <div style={{ ...ICON_WRAP, background: 'rgba(194,91,56,0.07)' }}>
          <CalendarIcon dim />
        </div>
        <div>
          <div style={{ ...DISPLAY, fontSize: '1.1rem' }}>Connect the well</div>
          <div style={{ ...BODY_SM, marginTop: 2 }}>
            No calendar connected yet — drop it in
          </div>
        </div>
      </div>

      {/* Benefit row */}
      <div
        style={{
          borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
          paddingTop: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ ...BODY_SM }}>
          Pulls your events into the well. Read-only — we never write back to your calendar.
        </div>
      </div>

      {/* Primary CTA — Sunshine #C25B38 */}
      <button
        onClick={() => connect(profileKey)}
        onMouseDown={() => setCtaDown(true)}
        onMouseUp={() => setCtaDown(false)}
        onMouseLeave={() => { setCtaDown(false); setHovered(false); }}
        style={{
          ...LABEL,
          fontSize: '0.82rem',
          color: '#fff',
          background: ctaDown ? '#a8461e' : hovered ? '#d4643c' : '#C25B38',
          border: 'none',
          borderRadius: 8,
          padding: '12px 20px',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'background 200ms ease-out, transform 200ms ease-out',
          transform: ctaDown ? 'scale(0.99)' : 'scale(1)',
        }}
      >
        Connect Google Calendar
        <span style={{ fontSize: '1em', lineHeight: 1, fontFamily: 'inherit' }}>→</span>
      </button>

      <div
        style={{
          ...BODY_SM,
          fontSize: '0.64rem',
          textAlign: 'center',
          marginTop: 10,
          color: 'rgba(138,125,114,0.7)',
        }}
      >
        Read-only · Google OAuth · Nothing written back
      </div>
    </div>
  );
}
