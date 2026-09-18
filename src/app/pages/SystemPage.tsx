import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';

function HealthRow({ label, value, status }: { label: string; value: string; status: 'ok' | 'warn' | 'error' | 'neutral' }) {
  const statusColor = { ok: '#30D158', warn: '#FF9F0A', error: '#FF453A', neutral: '#8A7D72' }[status];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.82rem',
        color: 'var(--cr8w-text, #2D2438)',
      }}>
        {label}
      </span>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-label)',
        fontSize: '0.75rem',
        color: statusColor,
        fontWeight: 600,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 4px ${statusColor}88`,
          flexShrink: 0,
        }} />
        {value}
      </span>
    </div>
  );
}

function DataCountRow({ label, count, emoji }: { label: string; count: number; emoji: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.08))',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.9rem' }}>{emoji}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--cr8w-text, #2D2438)' }}>
          {label}
        </span>
      </span>
      <span style={{
        fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 700,
        color: count > 0 ? 'var(--cr8w-text)' : 'var(--text-muted)',
      }}>
        {count}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'var(--text-muted)', marginBottom: 2, marginTop: 24,
    }}>
      {title}
    </div>
  );
}

function relativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

export function SystemPage() {
  const { data, actions } = useDashboard();

  const syncColor = data.syncStatus === 'fresh' ? 'ok' :
    data.syncStatus === 'stale' ? 'warn' :
    data.syncStatus === 'failed' ? 'error' : 'neutral';

  const syncLabel = {
    loading: 'Connecting…',
    fresh: data.lastSynced ? `Synced ${relativeTime(data.lastSynced)}` : 'Fresh',
    stale: data.lastSynced ? `Stale · last ${relativeTime(data.lastSynced)}` : 'Stale',
    failed: 'Sync failed',
  }[data.syncStatus];

  return (
    <ViewShell state="fresh">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            System Health
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--cr8w-text, #2D2438)', margin: 0, letterSpacing: '-0.02em',
          }}>
            What's running
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
          }}>
            Live status of data sync, modules, and system state.
          </p>
        </div>

        {/* Sync health */}
        <SectionHeader title="Data sync" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <HealthRow label="API connection" value={syncLabel} status={syncColor} />
          <HealthRow
            label="Last sync"
            value={data.lastSynced ? data.lastSynced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Never'}
            status={data.lastSynced ? 'neutral' : 'warn'}
          />
          <HealthRow
            label="Permissions: Care consent"
            value={data.permissions.careConsent ? 'Granted' : 'Not granted'}
            status={data.permissions.careConsent ? 'ok' : 'warn'}
          />
        </div>

        {data.syncStatus === 'failed' && (
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              onClick={() => actions.retrySync()}
              style={{
                padding: '7px 18px', borderRadius: 8,
                background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
                fontFamily: 'var(--font-label)', fontSize: '0.75rem', fontWeight: 600,
                border: 'none', cursor: 'pointer',
              }}
            >
              Retry sync
            </button>
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center',
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--border-soft)',
                fontFamily: 'var(--font-label)', fontSize: '0.75rem',
                color: 'var(--text-muted)', textDecoration: 'none',
              }}
            >
              Open Vercel ↗
            </a>
          </div>
        )}

        {/* Data counts */}
        <SectionHeader title="Data inventory" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <DataCountRow label="Tasks" count={data.tasks.length} emoji="⛲️" />
          <DataCountRow label="Stations" count={data.stations.length} emoji="🗂️" />
          <DataCountRow label="Forum posts" count={data.forum.length} emoji="💬" />
          <DataCountRow label="Messages" count={data.messages.length} emoji="📨" />
          <DataCountRow label="Workshops" count={data.workshops.length} emoji="🛠️" />
          <DataCountRow label="CoFlow dates" count={data.coFlowDates.length} emoji="🫧" />
          <DataCountRow label="Check-ins" count={data.coFlowCheckins.length} emoji="✅" />
          <DataCountRow label="Well notes" count={data.wellNotes.length} emoji="💧" />
          <DataCountRow label="Brain dumps" count={data.brainDumps.length} emoji="🧠" />
          <DataCountRow label="Announcements" count={data.announcements.length} emoji="📢" />
        </div>

        {/* Module routes */}
        <SectionHeader title="Registered routes" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          {[
            { path: '/', label: 'This Week at the Well', emoji: '💧' },
            { path: '/moves', label: 'Moves: Now', emoji: '⛲️' },
            { path: '/care', label: 'Care Loop', emoji: '🫧' },
            { path: '/flows', label: 'FLOWS', emoji: '🛠️' },
            { path: '/money', label: 'Money, Real Only', emoji: '💰' },
            { path: '/decisions', label: 'Decision Queue', emoji: '⚡' },
            { path: '/system', label: 'System Health', emoji: '🔧' },
          ].map(route => (
            <HealthRow
              key={route.path}
              label={`${route.emoji} ${route.label}`}
              value={route.path}
              status="ok"
            />
          ))}
        </div>

        {/* Build info */}
        <SectionHeader title="Build" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <HealthRow label="Router" value="react-router v7 · data mode" status="ok" />
          <HealthRow label="Data layer" value="DashboardContext · typed payload" status="ok" />
          <HealthRow label="API" value="Supabase edge functions" status="neutral" />
          <HealthRow label="Env" value={import.meta.env.MODE || 'production'} status="neutral" />
        </div>
      </div>
    </ViewShell>
  );
}
