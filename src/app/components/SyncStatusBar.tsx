import React, { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

const STATUS_CONFIG = {
  loading: { dot: '#FFD60A', label: 'Syncing…', bg: 'rgba(255, 214, 10, 0.06)' },
  fresh:   { dot: '#30D158', label: '',          bg: 'transparent' },
  stale:   { dot: '#FF9F0A', label: 'Stale',     bg: 'rgba(255, 159, 10, 0.06)' },
  failed:  { dot: '#FF453A', label: 'Sync failed', bg: 'rgba(255, 69, 58, 0.06)' },
} as const;

export function SyncStatusBar() {
  const { data, actions } = useDashboard();
  const { syncStatus, lastSynced } = data;
  const [, setTick] = useState(0);

  // Refresh relative time every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const cfg = STATUS_CONFIG[syncStatus];
  const timeLabel = lastSynced ? `Last synced ${relativeTime(lastSynced)}` : 'Not yet synced';

  if (syncStatus === 'fresh' && lastSynced && Date.now() - lastSynced.getTime() < 60_000) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '5px 16px',
        fontSize: '0.68rem',
        fontFamily: 'var(--font-label, Montserrat, sans-serif)',
        letterSpacing: '0.03em',
        color: 'var(--text-muted, #6B5F7A)',
        background: cfg.bg,
        borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
        transition: 'background 0.3s',
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cfg.dot,
          boxShadow: `0 0 5px ${cfg.dot}88`,
          flexShrink: 0,
          transition: 'background 0.3s',
        }}
      />
      <span>{timeLabel}{cfg.label ? ` · ${cfg.label}` : ''}</span>
      {(syncStatus === 'failed' || syncStatus === 'stale') && (
        <button
          onClick={() => actions.retrySync()}
          style={{
            background: 'none',
            border: '1px solid var(--border-soft, rgba(196,164,132,0.25))',
            borderRadius: 5,
            padding: '1px 8px',
            cursor: 'pointer',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            color: 'var(--text-muted, #6B5F7A)',
            letterSpacing: 'inherit',
          }}
        >
          Retry
        </button>
      )}
      {syncStatus === 'failed' && (
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--text-muted, #6B5F7A)',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            opacity: 0.7,
          }}
        >
          Deploy ↗
        </a>
      )}
    </div>
  );
}
