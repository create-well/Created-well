import React from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CalendarConnectCard } from '../components/CalendarConnectCard';
import { freshnessBand } from '../../lib/freshnessLabel';
import { ReleaseVerificationPanel } from '../components/ReleaseVerificationPanel';
import { sessionAccessToken } from '../components/api';
import {
  parseSyncRunsPayload,
  runDetailLine,
  runHistoryDisplay,
  runStartedDate,
  runStatusTone,
  type RunHistoryDisplay,
} from '../../lib/runHistory';

// Source database URLs — the databases of record behind the synced
// sources. Targets verified firsthand by the API lane 2026-11-05: the
// previous targets were a parallel same-titled database generation,
// not the databases behind the sync.
// KV-owned collections (messages, check-ins, workshops, well notes,
// brain dumps, announcements) have no Notion database at all, so they
// carry NO entry here (exec decision, register line 1168): inside this
// block, any target would assert a database that does not exist.
const NOTION_DB_LINKS: Record<string, string> = {
  // MOVES db of record (0978d7ba…) — tasks
  tasks:         'https://app.notion.com/p/0978d7ba16924fee8431bffd28eacce0',
  // PEOPLE db of record (4b2a211c…) — stations
  stations:      'https://app.notion.com/p/4b2a211c1dbc4c21af7953dfd6e0ff21',
  // CONTENT db of record (b9aa570c…) — forum posts
  forum:         'https://app.notion.com/p/b9aa570c4072489e987ec3522a6a2b07',
  // FLOWS db of record (3cd37e75…) — coflow dates (Type: Podyap/Workshop/…)
  coFlowDates:   'https://app.notion.com/p/3cd37e7529604bc8b07d76d0c0089fd7',
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
    sources: 'MOVES hub (tasks) · PEOPLE hub (stations) · CONTENT hub (forum) — Status: Now / Next / Done / Blocked / Dropped' },
  { path: '/care',      label: 'Care Loop',             emoji: '🫧',
    sources: 'PEOPLE hub (messages, check-ins, well notes)' },
  { path: '/flows',     label: 'Flows',                 emoji: '🛠️',
    sources: 'FLOWS hub — all Types · workshops' },
  { path: '/podyaps',   label: 'Podyaps',               emoji: '🎙️',
    sources: 'FLOWS hub — Type: Podyap (Status: Upcoming / Active / Archived)' },
  { path: '/workshops', label: 'Workshops',             emoji: '🎨',
    sources: 'FLOWS hub — Type: Workshop · MOVES hub (workshop tasks)' },
  { path: '/money',     label: 'Money, Real Only',      emoji: '💰',
    sources: 'Create Well — Budget & P&L Bookkeeping workbook (Transactions) — cr8w_money KV feed; dashboard read only; quick log retired (POST /money returns 410, log money in the workbook)' },
  { path: '/decisions', label: 'Decision Queue',        emoji: '⚡',
    sources: 'cr8w_decisions KV resource — dashboard read/write (no Notion counterpart, by design)' },
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
  label, count, emoji, internalPath, notionHref, source,
}: {
  label: string;
  count: number;
  emoji: string;
  internalPath?: string;
  notionHref?: string;
  source?: string;
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
              color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
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
        {source && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: 'var(--text-muted)', opacity: 0.75 }}>
            · {source}
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
            color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
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

type RunHistoryState =
  | { kind: 'loading' }
  | { kind: 'display'; display: RunHistoryDisplay };

export function SystemPage() {
  const { data, actions } = useDashboard();

  // Run history reads the durable sync_runs store through the
  // session-gated reader (G-35 Option B, PR #66): the route takes the
  // app session token as a Bearer header, the HubView fetch pattern.
  // The display state comes from runHistoryDisplay, which reads the
  // endpoint's store marker: only a real store read may render runs
  // or the empty wording; every other 200 renders the failure state.
  const [runHistory, setRunHistory] = React.useState<RunHistoryState>({ kind: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sync-runs?limit=5', {
          headers: { Authorization: `Bearer ${sessionAccessToken() ?? ''}` },
        });
        if (!res.ok) throw new Error('run history read failed');
        const read = parseSyncRunsPayload(await res.json());
        if (cancelled) return;
        setRunHistory({ kind: 'display', display: runHistoryDisplay(read) });
      } catch {
        if (!cancelled) {
          setRunHistory({ kind: 'display', display: runHistoryDisplay(null) });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const display = runHistory.kind === 'display' ? runHistory.display : null;
  const displayRuns = display?.kind === 'rows' ? display.runs : [];
  const latestRun = displayRuns[0];
  const latestRunDate = latestRun ? runStartedDate(latestRun) : null;
  const runRow: { value: string; status: 'ok' | 'warn' | 'error' | 'neutral' } =
    runHistory.kind === 'loading' || display === null
      ? { value: 'Loading…', status: 'neutral' }
      : display.kind === 'failed'
        ? { value: 'Could not load', status: 'neutral' }
        : display.kind === 'empty'
          ? { value: 'No runs recorded yet', status: 'neutral' }
          : {
              value: `${latestRun.status}${latestRunDate ? ` · ${relativeTime(latestRunDate)}` : ''}`,
              status: runStatusTone(latestRun.status),
            };

  // Freshness wording derives from the load timestamp's age at render
  // (G-26: the Fresh/Aging/Stale family, CMS §4 thresholds), never from a
  // stored claim: the previous fresh label read "Synced {x ago}" beside a
  // stale label in different vocabulary, with no Aging band.
  const band = freshnessBand(data.lastSynced);
  const syncColor = data.syncStatus === 'failed' ? 'error' :
    data.syncStatus === 'loading' ? 'neutral' :
    band === 'Fresh' ? 'ok' :
    band ? 'warn' : 'neutral';

  const syncLabel = data.syncStatus === 'loading' ? 'Connecting…' :
    data.syncStatus === 'failed' ? 'Sync failed' :
    band && data.lastSynced ? `${band} · last loaded ${relativeTime(data.lastSynced)}` :
    'No successful load yet';

  // The custom-domain state lives on this surface, the one that owns the
  // configuration (UX ruling 1497): it used to render as a standing banner
  // in the RootLayout stack on every origin but the custom domain. The row
  // reads the viewer's actual hostname at render, nothing stored.
  const onCustomDomain = window.location.hostname === 'createwell.monnyfest.co';

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
            label="Run history"
            value={runRow.value}
            status={runRow.status}
          />
          {displayRuns.length > 0 && (
            <div style={{ padding: '4px 0 8px' }}>
              {displayRuns.map((run, i) => {
                const started = runStartedDate(run);
                return (
                  <div
                    key={`${run.startedAt}-${i}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', gap: 12,
                      padding: '3px 0',
                      fontFamily: 'var(--font-label)', fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>
                      {started
                        ? `${started.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${started.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                        : 'Time not recorded'}
                      {' · '}{run.trigger}
                    </span>
                    <span style={{ textAlign: 'right' }}>{runDetailLine(run)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <HealthRow
            label="Permissions: Care consent"
            value={data.permissions.careConsent ? 'Granted' : 'Not granted'}
            status={data.permissions.careConsent ? 'ok' : 'warn'}
          />
          {/* The domain notice as a plain row in this card's idiom. The
              value is a full sentence, so it takes the page's readable
              text color, not a status tone: label --cr8w-text, value
              --text-secondary, on the theme card background. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 0',
          }}>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.82rem',
              color: 'var(--cr8w-text, #2D2438)',
            }}>
              Custom domain
            </span>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '0.75rem',
              color: 'var(--text-secondary, #443855)', fontWeight: 600,
              textAlign: 'right',
            }}>
              {onCustomDomain ? "Live — you're viewing via the custom domain" : "Setting up — you're viewing via the direct link"}
            </span>
          </div>
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

        {/* Data inventory */}
        <SectionHeader title="Data inventory" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <DataCountRow label="Tasks"        count={data.tasks.length}          emoji="⛲️" internalPath="/moves"  notionHref={NOTION_DB_LINKS.tasks} source="MOVES hub" />
          <DataCountRow label="Stations"     count={data.stations.length}       emoji="🗂️" internalPath="/moves"  notionHref={NOTION_DB_LINKS.stations} source="PEOPLE hub" />
          <DataCountRow label="Forum posts"  count={data.forum.length}          emoji="💬" internalPath="/moves"  notionHref={NOTION_DB_LINKS.forum} source="CONTENT hub" />
          <DataCountRow label="Messages"     count={data.messages.length}       emoji="📨" internalPath="/care"   source="KV store" />
          <DataCountRow label="Workshops"    count={data.workshops.length}      emoji="🛠️" internalPath="/flows"  source="KV store" />
          <DataCountRow label="CoFlow dates" count={data.coFlowDates.length}    emoji="🫧" internalPath="/flows"  notionHref={NOTION_DB_LINKS.coFlowDates} source="FLOWS hub" />
          <DataCountRow label="Check-ins"    count={data.coFlowCheckins.length} emoji="✅" internalPath="/care"   source="KV store" />
          <DataCountRow label="Well notes"   count={data.wellNotes.length}      emoji="💧" internalPath="/"       source="KV store" />
          <DataCountRow label="Brain dumps"  count={data.brainDumps.length}     emoji="🧠" internalPath="/"       source="KV store" />
          <DataCountRow label="Announcements" count={data.announcements.length} emoji="📢" internalPath="/"       source="KV store" />
        </div>

        {/* Public release verification (G-11 Consumer 1) */}
        <SectionHeader title="Public release" />
        <div style={{
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          borderRadius: 12, padding: '4px 16px',
        }}>
          <ReleaseVerificationPanel workingRows={data.forum} />
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
