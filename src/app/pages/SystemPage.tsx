import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CalendarConnectCard } from '../components/CalendarConnectCard';
import { getHistoryReport, getHistoryCsvUrl, getWorkspaceConflicts, type HistoryReport, type WorkspaceConflict } from '../components/api';

// Hub CMS database URLs — these are the four DBs the dashboard reads/writes.
// Distinct from the operational five (PEOPLE/FLOWS/MOVES/MONEY/CONTENT) which
// are the team's source of truth; the hub DBs are the dashboard-specific cache layer.
// IDs sourced from CR8W — API ID Registry (last verified 2026-09-18).
const NOTION_DB_LINKS: Record<string, string> = {
  // MOVES hub (DB: 49faf111…)  — tasks, stations, forum posts
  tasks:         'https://app.notion.com/p/49faf1111bbe43458c3e6a4dcec63b5c',
  stations:      'https://app.notion.com/p/49faf1111bbe43458c3e6a4dcec63b5c',
  forum:         'https://app.notion.com/p/49faf1111bbe43458c3e6a4dcec63b5c',
  // PEOPLE hub (DB: 81fc482d…)  — messages, check-ins
  messages:      'https://app.notion.com/p/81fc482da44d43cb9c426952654944ab',
  checkins:      'https://app.notion.com/p/81fc482da44d43cb9c426952654944ab',
  // FLOWS hub (DB: 8d9ebf0c…)   — coflow dates (Type: Podyap/Workshop/…), workshops
  workshops:     'https://app.notion.com/p/8d9ebf0c04cb47219ca2e3942cee6212',
  coFlowDates:   'https://app.notion.com/p/8d9ebf0c04cb47219ca2e3942cee6212',
  // CONTENT hub (DB: 08a0e011…) — well notes, brain dumps, announcements
  wellNotes:     'https://app.notion.com/p/08a0e011142a4512a3dc8075800db7db',
  brainDumps:    'https://app.notion.com/p/08a0e011142a4512a3dc8075800db7db',
  announcements: 'https://app.notion.com/p/08a0e011142a4512a3dc8075800db7db',
};

const CONTENT_CHANNELS = [
  { label: 'Newsletter',       emoji: '📬', href: 'https://www.sunshinedgtlstudios.com/cr8wnewsletter' },
  { label: 'Events (Partiful)',emoji: '🎉', href: 'https://partiful.com/uYXpeCS9xuzmgObb7Q7jf' },
  { label: 'Book Club RSVP',   emoji: '📚', href: 'https://docs.google.com/forms/d/e/1FAIpQLSdru8LxeVv8HqjxAHMZ0pgFRcPs3bw8uSk7FjqxeHWKn-Urg/viewform' },
  { label: 'YouTube',          emoji: '▶️',  href: 'https://www.youtube.com/@brbcreatingwell' },
  { label: 'Spotify',          emoji: '🎵', href: 'https://open.spotify.com/show/0Tj253e1ZAE7vsKd4Tffvi' },
  { label: 'Apple Podcasts',   emoji: '🎙️', href: 'https://podcasts.apple.com/us/podcast/brb-creating-well-a-create-well-podcast/id6795904154' },
  { label: 'Amazon Music',     emoji: '🎶', href: 'https://music.amazon.com/podcasts/e1ff7602-912c-488b-a11f-e6fb6027dbba' },
  { label: 'Instagram',        emoji: '📸', href: 'https://www.instagram.com/brbcreatingwell' },
];

const ROUTE_ARCHITECTURE = [
  { path: '/',          label: 'This Week at the Well', emoji: '💧',
    sources: 'CONTENT hub (brain dumps · well notes · announcements) + FLOWS hub' },
  { path: '/moves',     label: 'Moves: Now',            emoji: '⛲️',
    sources: 'MOVES hub (tasks, stations, forum) — Status: Not Started / In Progress / Done / Blocked' },
  { path: '/care',      label: 'Care Loop',             emoji: '🫧',
    sources: 'PEOPLE hub (messages, check-ins, well notes)' },
  { path: '/flows',     label: 'Flows',                 emoji: '🛠️',
    sources: 'FLOWS hub — all Types · workshops' },
  { path: '/podyaps',   label: 'Podyaps',               emoji: '🎙️',
    sources: 'FLOWS hub — Type: Podyap (Status: Upcoming / Active / Archived)' },
  { path: '/workshops', label: 'Workshops',             emoji: '🎨',
    sources: 'FLOWS hub — Type: Workshop · MOVES hub (workshop tasks)' },
  { path: '/money',     label: 'Money, Real Only',      emoji: '💰',
    sources: 'MONEY DB — Stage: Possible → Committed → Invoiced → Received → Paid (read-only)' },
  { path: '/decisions', label: 'Decision Queue',        emoji: '⚡',
    sources: 'pending — not yet connected to Notion' },
  { path: '/system',    label: 'System Health',         emoji: '🔧',
    sources: 'all hub collections · build info · API ID Registry' },
];

const SUGGESTED_IMPROVEMENTS = [
  { label: 'Notion deep links from every data row',                              done: true },
  { label: 'Add Omar to Moves task filter',                                      done: true },
  { label: 'Dedicated /podyaps mini-dashboard',                                  done: true },
  { label: 'Dedicated /workshops mini-dashboard',                                done: true },
  { label: 'Fix Hub MiniCard navigation (was all → /flows)',                     done: true },
  { label: 'Add Type select to FLOWS hub DB (Podyap/Workshop/Book Club/…)',      done: true },
  { label: 'Fix FLOW_STATUS_MAP for hub DB values (Upcoming/Active/Archived)',   done: true },
  { label: 'Fix isPodyap filter: use flowType field, not theme guessing',        done: true },
  { label: 'Fix notionWriter coflow Status mapping (idea→Upcoming, etc.)',       done: true },
  { label: 'SystemPage DB links point to hub CMS DBs (not operational five)',    done: true },
  { label: 'Fix scripts/seed-username-map.mjs — writes to dead kv_store_8dcd9693 table', done: false },
  { label: 'Real-time announcement push (replace prompt() with modal form)',     done: false },
  { label: 'Weekly digest auto-generated from brain dumps into Notion CONTENT',  done: false },
  { label: 'Per-person Flow RSVP tracking (links to PEOPLE hub)',               done: false },
  { label: 'Hub hero: surface next Podyap card instead of generic CoFlow',      done: false },
  { label: 'Hub widget: last Notion sync timestamp visible on home page',        done: false },
  { label: 'Decision Queue (/decisions) connected to Notion database',           done: false },
  { label: 'Money page (/money) — Phase 2 write bridge to MONEY DB',            done: false },
];

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

function DataCountRow({
  label, count, emoji, internalPath, notionHref,
}: {
  label: string;
  count: number;
  emoji: string;
  internalPath?: string;
  notionHref?: string;
}) {
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
        {internalPath ? (
          <Link
            to={internalPath}
            style={{
              fontFamily: 'var(--font-body)', fontSize: '0.78rem',
              color: 'var(--cr8w-primary, #7BA89D)', textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {label}
          </Link>
        ) : (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--cr8w-text, #2D2438)' }}>
            {label}
          </span>
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 700,
          color: count > 0 ? 'var(--cr8w-text)' : 'var(--text-muted)',
        }}>
          {count}
        </span>
        {notionHref && (
          <a
            href={notionHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-label)', fontSize: '0.65rem',
              color: 'var(--text-muted)', textDecoration: 'none',
              opacity: 0.7,
            }}
          >
            ↗
          </a>
        )}
      </span>
    </div>
  );
}

function LinkRow({ emoji, label, href }: { emoji: string; label: string; href: string }) {
  const domain = (() => {
    try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return href; }
  })();
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: 'var(--font-label)', fontSize: '0.68rem',
          color: 'var(--text-muted)', textDecoration: 'none',
          opacity: 0.8,
        }}
      >
        {domain} ↗
      </a>
    </div>
  );
}

function RouteRow({ path, label, emoji, sources }: { path: string; label: string; emoji: string; sources: string }) {
  return (
    <div style={{
      padding: '9px 0',
      borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.12))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--cr8w-text, #2D2438)' }}>
          {emoji} {label}
        </span>
        <Link
          to={path}
          style={{
            fontFamily: 'var(--font-label)', fontSize: '0.73rem', fontWeight: 600,
            color: 'var(--cr8w-primary, #7BA89D)', textDecoration: 'none',
          }}
        >
          {path}
        </Link>
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.68rem',
        color: 'var(--text-muted)', marginTop: 2,
        opacity: 0.75,
      }}>
        {sources}
      </div>
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
  const [historyReport, setHistoryReport] = useState<HistoryReport | null>(null);
  const [workspaceConflicts, setWorkspaceConflicts] = useState<WorkspaceConflict[]>([]);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getHistoryReport(), getWorkspaceConflicts()]).then(([report, conflicts]) => {
      if (!active) return;
      setHistoryReport(report);
      setWorkspaceConflicts(conflicts);
    }).catch(error => {
      if (active) setHistoryError(error instanceof Error ? error.message : 'History report unavailable');
    });
    return () => { active = false; };
  }, []);

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
            What&apos;s running
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
          }}>
            Live status of data sync, modules, and system state.
          </p>
        </div>

        {/* Google Calendar connection */}
        <SectionHeader title="Calendar" />
        <CalendarConnectCard profileKey="monny" />

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

        {/* Historical reporting + Workspace mirror */}
        <SectionHeader title="History + Workspace mirror" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '12px 16px',
        }}>
          <HealthRow
            label="Canonical history"
            value={historyReport ? `${historyReport.summary.note_count} notes · ${historyReport.summary.checkin_count} check-ins` : historyError ? 'Unavailable' : 'Loading…'}
            status={historyError ? 'error' : historyReport ? 'ok' : 'neutral'}
          />
          <HealthRow
            label="Landed currents"
            value={historyReport ? String(historyReport.summary.landed_count) : '—'}
            status="neutral"
          />
          <HealthRow
            label="Workspace conflicts"
            value={workspaceConflicts.length ? `${workspaceConflicts.length} need resolution` : 'None open'}
            status={workspaceConflicts.length ? 'warn' : 'ok'}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, padding: '12px 0 3px' }}>
            <a href={getHistoryCsvUrl()} download style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--cr8w-primary, #7BA89D)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, textDecoration: 'none' }}>
              export CSV
            </a>
            <a href={getHistoryCsvUrl()} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border-soft)', color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, textDecoration: 'none' }}>
              view raw export ↗
            </a>
          </div>
          {historyError && <p style={{ margin: '8px 0 0', color: '#A9553D', fontFamily: 'var(--font-body)', fontSize: '0.72rem', lineHeight: 1.4 }}>{historyError}</p>}
          {workspaceConflicts.length > 0 && <p style={{ margin: '8px 0 0', color: '#8A6A2F', fontFamily: 'var(--font-body)', fontSize: '0.72rem', lineHeight: 1.4 }}>The mirror is paused until the open Sheet edit{workspaceConflicts.length === 1 ? '' : 's'} is resolved. No canonical facts were overwritten.</p>}
        </div>

        {/* Data inventory */}
        <SectionHeader title="Data inventory" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <DataCountRow label="Tasks"        count={data.tasks.length}          emoji="⛲️" internalPath="/moves"  notionHref={NOTION_DB_LINKS.tasks} />
          <DataCountRow label="Stations"     count={data.stations.length}       emoji="🗂️" internalPath="/moves"  notionHref={NOTION_DB_LINKS.stations} />
          <DataCountRow label="Forum posts"  count={data.forum.length}          emoji="💬" internalPath="/moves"  notionHref={NOTION_DB_LINKS.forum} />
          <DataCountRow label="Messages"     count={data.messages.length}       emoji="📨" internalPath="/care"   notionHref={NOTION_DB_LINKS.messages} />
          <DataCountRow label="Workshops"    count={data.workshops.length}      emoji="🛠️" internalPath="/flows"  notionHref={NOTION_DB_LINKS.workshops} />
          <DataCountRow label="CoFlow dates" count={data.coFlowDates.length}    emoji="🫧" internalPath="/flows"  notionHref={NOTION_DB_LINKS.coFlowDates} />
          <DataCountRow label="Check-ins"    count={data.coFlowCheckins.length} emoji="✅" internalPath="/care"   notionHref={NOTION_DB_LINKS.checkins} />
          <DataCountRow label="Well notes"   count={data.wellNotes.length}      emoji="💧" internalPath="/"       notionHref={NOTION_DB_LINKS.wellNotes} />
          <DataCountRow label="Brain dumps"  count={data.brainDumps.length}     emoji="🧠" internalPath="/"       notionHref={NOTION_DB_LINKS.brainDumps} />
          <DataCountRow label="Announcements" count={data.announcements.length} emoji="📢" internalPath="/"       notionHref={NOTION_DB_LINKS.announcements} />
        </div>

        {/* Content channels */}
        <SectionHeader title="Content channels" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          {CONTENT_CHANNELS.map(ch => (
            <LinkRow key={ch.label} emoji={ch.emoji} label={ch.label} href={ch.href} />
          ))}
        </div>

        {/* Site architecture */}
        <SectionHeader title="Site architecture" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          {ROUTE_ARCHITECTURE.map(route => (
            <RouteRow key={route.path} path={route.path} label={route.label} emoji={route.emoji} sources={route.sources} />
          ))}
        </div>

        {/* Build info */}
        <SectionHeader title="Build" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <HealthRow label="Router"     value="react-router v7 · data mode"      status="ok" />
          <HealthRow label="Data layer" value="DashboardContext · typed payload"  status="ok" />
          <HealthRow label="API"        value="Supabase edge functions"           status="neutral" />
          <HealthRow label="Env"        value={import.meta.env.MODE || 'production'} status="neutral" />
        </div>

        {/* Suggested improvements */}
        <SectionHeader title="Suggested improvements" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '12px 16px',
          opacity: 0.82,
        }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            aspirational · not production-ready
          </div>
          {SUGGESTED_IMPROVEMENTS.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '5px 0',
              borderBottom: '1px solid var(--border-soft, rgba(196,164,132,0.07))',
            }}>
              <span style={{
                fontSize: '0.75rem', marginTop: 1,
                color: item.done ? '#30D158' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {item.done ? '✓' : '○'}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.76rem',
                color: item.done ? 'var(--text-muted)' : 'var(--cr8w-text, #2D2438)',
                fontStyle: item.done ? 'italic' : 'normal',
                opacity: item.done ? 0.65 : 1,
                lineHeight: 1.4,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ViewShell>
  );
}
