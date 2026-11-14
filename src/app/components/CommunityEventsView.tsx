import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { localDateString } from '../../lib/dateLabel';
import {
  PERSONS, TASK_ROLES, HD_PROFILES,
  formatDate,
} from './data';
import type { CoFlowDate, Task } from './api';
import {
  isPodyap,
  isWorkshop,
  isBookClub,
  isGroupEvent,
  seriesOf,
  groupFlowsBySeries,
  boardPopulation,
  flowHeading,
  depantyQueue,
  DEPANTY_RULE_LABEL,
} from '../../lib/flows';

type Tab = 'upcoming' | 'depanty' | 'podyaps' | 'workshops' | 'moves' | 'team';

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'upcoming',   label: 'Board',              emoji: '📅' },
  { key: 'depanty',    label: 'Depanty',            emoji: '🧺' },
  { key: 'podyaps',    label: 'Podyaps',             emoji: '🎙️' },
  { key: 'workshops',  label: 'Book Club + Shops',   emoji: '🎨' },
  { key: 'moves',      label: 'Moves',               emoji: '📋' },
  { key: 'team',       label: 'Team',                emoji: '✨' },
];

const FLOW_ARCHIVED = new Set(['happened', 'wrapped', 'cancelled']);
const FLOW_STATUS_LABELS: Record<string, string> = {
  idea: 'Idea', ready: 'Ready', approved: 'Approved', scheduled: 'Scheduled',
  happened: 'Happened', wrapped: 'Wrapped', cancelled: 'Cancelled',
};

function statusPill(status: string) {
  const isArchived = FLOW_ARCHIVED.has(status);
  const shade = isArchived ? 'var(--status-archived)' : 'var(--status-done)';
  const s = {
    label: FLOW_STATUS_LABELS[status] || status,
    bg:    `color-mix(in srgb, ${shade} 12%, transparent)`,
    color: shade,
  };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 8, fontSize: '0.6rem', fontWeight: 700,
      fontFamily: 'var(--font-label)', letterSpacing: '0.04em', textTransform: 'uppercase',
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function FlowCard({ flow }: { flow: CoFlowDate }) {
  const navigate = useNavigate();
  const dateStr = flow.date ? formatDate(flow.date) : 'Date not set yet.';
  const hostPerson = flow.host ? PERSONS[flow.host] : null;
  // Partiful is the RSVP platform of record (register 1484, Leg 2): a flow
  // whose related event carries a Partiful link offers it as the RSVP door.
  // Upcoming only — a past event takes no RSVPs.
  const showRsvp = !!flow.partifulLink && (!flow.date || flow.date >= localDateString(new Date()));
  return (
    <div
      onClick={() => navigate(`/gatherings/${flow.id}`)}
      style={{
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.3 }}>
            {flowHeading(flow)}
          </div>
          {flow.theme && flow.title && flow.theme !== flow.title && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)', marginTop: 2 }}>
              {flow.theme}
            </div>
          )}
        </div>
        {statusPill(flow.status)}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)', display: 'flex', alignItems: 'center', gap: 4 }}>
          📅 {dateStr}
          {flow.timeRange ? ` · ${flow.timeRange}` : ''}
        </span>
        {flow.location && flow.location !== 'TBD' && (
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)', display: 'flex', alignItems: 'center', gap: 4 }}>
            📍 {flow.location}
          </span>
        )}
        {hostPerson && (
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: hostPerson.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            {hostPerson.emoji} {hostPerson.name}
          </span>
        )}
        {flow.stage && (
          <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🌊 {flow.stage}
          </span>
        )}
      </div>

      {flow.notes && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.5 }}>
          {flow.notes}
        </div>
      )}

      {showRsvp && (
        <div>
          <a
            href={flow.partifulLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
              color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            RSVP on Partiful ↗
          </a>
        </div>
      )}

      {/* Day-of entry (packet L §3): on the day itself, the card
          offers the day-of door directly. */}
      {flow.date && flow.date.slice(0, 10) === localDateString(new Date()) && (
        <div>
          <a
            href={`/gatherings/${flow.id}/day-of`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/gatherings/${flow.id}/day-of`); }}
            style={{
              fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
              color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            Run the day →
          </a>
        </div>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: '2rem' }}>{emoji}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--cr8w-text, #2D2438)' }}>{title}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted, #8A7060)', maxWidth: 280, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

// ── Board tab (Phase 2a, packet K §3) ───────────────────────────────────────
// The Gatherings board: the default surface, replacing the old
// Upcoming list. The population is the same slice the Upcoming
// tab drew from (the parent's community-flows-or-all set); the
// board groups it by series through groupFlowsBySeries — SLO
// Create first, the unfiled group last — and orders each group
// by stage, then date. Every card opens the gathering's detail
// page. The countdown banner and the past-five cap are gone with
// the old tab: wrapped gatherings live in their stage groups.

function BoardTab({ flows }: { flows: CoFlowDate[] }) {
  const groups = groupFlowsBySeries(flows);
  if (flows.length === 0) {
    return (
      <EmptyState emoji="🌊" title="Nothing flowing yet" body="Community events from FLOWS will appear here once scheduled in Notion." />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
        {flows.length} gathering{flows.length === 1 ? '' : 's'} by series
      </div>
      {groups.map((group) => (
        <div key={group.series} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted, #8A7060)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {group.series} ({group.flows.length})
          </div>
          {group.flows.map(f => <FlowCard key={f.id} flow={f} />)}
        </div>
      ))}
    </div>
  );
}

// ── Podyaps tab ───────────────────────────────────────────────────────────────

function PodyapsTab({ flows }: { flows: CoFlowDate[] }) {
  const navigate = useNavigate();
  if (!flows.length) return (
    <EmptyState emoji="🎙️" title="No Podyaps yet" body="Yapcasts and Playdates from FLOWS will appear here. Add a FLOW in Notion with Type = Yapcast or Playdate." />
  );

  const today = localDateString();
  const upcoming = flows.filter(f => f.date >= today && !FLOW_ARCHIVED.has(f.status)).sort((a, b) => a.date.localeCompare(b.date));
  const past     = flows.filter(f => !f.date || f.date < today || FLOW_ARCHIVED.has(f.status)).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {upcoming.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700, color: '#7B5FD4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coming Up</div>
          {upcoming.map(f => <FlowCard key={f.id} flow={f} />)}
        </>
      )}
      {past.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted, #8A7060)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Past Episodes</div>
          {past.map(f => <FlowCard key={f.id} flow={f} />)}
        </>
      )}
      <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
        <button
          onClick={() => navigate('/making')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
            color: '#7B5FD4', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          Full Making view &amp; preflight →
        </button>
      </div>
    </div>
  );
}

// ── Workshops tab ─────────────────────────────────────────────────────────────

function WorkshopsTab({ flows }: { flows: CoFlowDate[] }) {
  const [sub, setSub] = useState<'book-club' | 'workshops'>('workshops');
  // Workshops-proper filter (model of record, 2026-11-14): SLO Create
  // is the core monthly offering, its own series, never a workshop —
  // an SLO Create row never renders inside this tab. Phase 2a makes
  // the exclusion field-first (packet K §3): seriesOf reads the
  // projected Series field, with the landed name guard as its
  // fallback for rows with no Series filed.
  const bookClub  = flows.filter(f => isBookClub(f) && seriesOf(f) !== 'SLO Create');
  const workshops = flows.filter(f => isWorkshop(f) && seriesOf(f) !== 'SLO Create');
  const shown = sub === 'book-club' ? bookClub : workshops;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0 }}>
        {([
          { key: 'workshops' as const, label: '🎨 Wellshops', count: workshops.length },
          { key: 'book-club' as const, label: '📚 Book Club', count: bookClub.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              flex: 1,
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: t.key === 'workshops' ? '10px 0 0 10px' : '0 10px 10px 0',
              border: sub === t.key ? '1.5px solid var(--cr8w-primary, #7BA89D)' : '1px solid rgba(0,0,0,0.1)',
              background: sub === t.key ? 'rgba(123,168,157,0.1)' : 'transparent',
              color: sub === t.key ? 'var(--cr8w-primary, #7BA89D)' : 'var(--text-muted)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.72rem',
              fontWeight: sub === t.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          emoji={sub === 'book-club' ? '📚' : '🎨'}
          title={sub === 'book-club' ? 'No Book Club sessions yet' : 'No Workshops yet'}
          body={`Add a FLOW in Notion with Type = ${sub === 'book-club' ? 'Book Club' : 'Workshop'} to have it appear here.`}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.sort((a, b) => b.date.localeCompare(a.date)).map(f => <FlowCard key={f.id} flow={f} />)}
        </div>
      )}
    </div>
  );
}

// ── Moves tab ─────────────────────────────────────────────────────────────────

function MovesTab({ tasks }: { tasks: Task[] }) {
  const [filter, setFilter] = useState<string>('all');
  const shown = filter === 'all' ? tasks : tasks.filter(t => t.person === filter);
  const active = shown.filter(t => t.status !== 'done').sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return (priority[a.priority] ?? 1) - (priority[b.priority] ?? 1);
  });
  const done = shown.filter(t => t.status === 'done');

  const ROLE_KEYS = ['all', ...Object.keys(TASK_ROLES)];

  function statusColor(s: Task['status']) {
    // The --status-* shade set (cr8w.css): one deep shade per
    // status, AA as small text on white and cream. The old iOS
    // system hexes failed at 1.90-3.08:1 and Next/Dropped shared
    // one fallback color; both defects end here.
    return s === 'in_progress' ? 'var(--status-now)'
      : s === 'done' ? 'var(--status-done)'
      : s === 'blocked' ? 'var(--status-blocked)'
      : s === 'dropped' ? 'var(--status-dropped)'
      : 'var(--status-next)';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ROLE_KEYS.map(key => {
          const role = key === 'all' ? null : TASK_ROLES[key];
          const isActive = filter === key;
          return (
            <button
              key={key}
              className="cr-hit44"
              onClick={() => setFilter(key)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: isActive ? `1.5px solid ${role?.color || 'var(--cr8w-primary, #7BA89D)'}` : '1px solid rgba(0,0,0,0.1)',
                background: isActive ? `${role?.color || '#7BA89D'}15` : 'transparent',
                color: isActive ? (role?.color || 'var(--cr8w-primary, #7BA89D)') : 'var(--text-muted)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.7rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {key === 'all' ? 'All' : `${role?.emoji} ${role?.name}`}
            </button>
          );
        })}
      </div>

      {active.length === 0 && done.length === 0 ? (
        <EmptyState emoji="📋" title="No moves yet" body="Tasks from MOVES in Notion will appear here." />
      ) : (
        <>
          {active.map(t => (
            <div key={t.id} style={{
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.07)',
              borderLeft: `3px solid ${statusColor(t.status)}`,
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.35, flex: 1 }}>{t.title}</div>
                <span style={{
                  padding: '2px 7px', borderRadius: 7, fontSize: '0.6rem', fontWeight: 700,
                  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: t.status === 'blocked' ? 'var(--status-blocked)' : `color-mix(in srgb, ${statusColor(t.status)} 8%, transparent)`,
                  color: t.status === 'blocked' ? '#F6EBDF' : statusColor(t.status), flexShrink: 0,
                }}>
                  {t.status === 'in_progress' ? 'Now' : t.status === 'todo' ? 'Next' : t.status === 'blocked' ? 'Blocked' : t.status === 'dropped' ? 'Dropped' : t.status === 'done' ? 'Done' : t.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.person && TASK_ROLES[t.person] && (
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: TASK_ROLES[t.person].color }}>
                    {TASK_ROLES[t.person].emoji} {TASK_ROLES[t.person].name}
                  </span>
                )}
                {t.due_date && (
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Due {formatDate(t.due_date)}
                  </span>
                )}
                {t.category && (
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 6 }}>
                    {t.category}
                  </span>
                )}
              </div>
            </div>
          ))}
          {done.length > 0 && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
              Done this cycle ({done.length})
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(PERSONS).map(([key, person]) => {
        const hd = HD_PROFILES[key];
        const isExpanded = expanded === key;
        return (
          <div
            key={key}
            style={{
              background: '#fff',
              border: `1.5px solid ${person.color}33`,
              borderRadius: 14,
              overflow: 'hidden',
              transition: 'box-shadow 0.2s',
              boxShadow: isExpanded ? `0 4px 16px ${person.color}22` : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : key)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: `${person.color}20`, border: `2px solid ${person.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem',
              }}>{person.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600, color: person.color }}>{person.name}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{person.role}</div>
              </div>
              <span style={{ color: person.color, opacity: 0.5, fontSize: '0.8rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>→</span>
            </button>

            {isExpanded && hd && (
              <div style={{ borderTop: `1px solid ${person.color}20`, padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Type', value: hd.typeShort },
                    { label: 'Profile', value: hd.profile },
                    { label: 'Authority', value: hd.authority.split(' ')[0] },
                  ].map(item => (
                    <span key={item.label} style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 700,
                      fontFamily: 'var(--font-label)', background: `${person.color}15`, color: person.color,
                    }}>
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {hd.typeDescription}
                </div>
                <div style={{ background: `${person.color}0A`, borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700, color: person.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {person.energyReminder.type}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {person.energyReminder.text}
                  </div>
                </div>
              </div>
            )}

            {isExpanded && !hd && (
              <div style={{ borderTop: `1px solid ${person.color}20`, padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {person.energyReminder.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Depanty queue (Phase 2b, packet L §1–§2, as amended) ────────────────────
// Membership is computed by depantyQueue() — happened (or
// carrying a linked open depanty Move, A1) and failing the
// draft exit test. Rows open the 2a detail page; there is no
// second editor, and leaving the queue is computed, never filed.

function DepantyTab({ flows, tasks, syncStatus }: {
  flows: CoFlowDate[];
  tasks: Task[];
  syncStatus?: string;
}) {
  const navigate = useNavigate();
  const settled = syncStatus === 'fresh' || syncStatus === 'stale';
  const queue = settled ? depantyQueue(flows, tasks, localDateString(new Date())) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.78rem', color: 'var(--text-secondary, #6B5F7A)' }}>
          {settled
            ? `${queue.length} gathering${queue.length === 1 ? '' : 's'} to close out`
            : 'Close-out queue'}
        </div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted, #8A7060)' }}>
          {DEPANTY_RULE_LABEL}
        </div>
        {syncStatus === 'stale' && (
          <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
            Last-good read — not a live read.
          </div>
        )}
      </div>

      {!settled ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #8A7060)' }}>
          Loading the close-out queue…
        </div>
      ) : queue.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #8A7060)' }}>
          Nothing waiting to close out.
        </div>
      ) : queue.map(({ flow, exit, depantyMove, ageDays }) => (
        <div
          key={flow.id}
          onClick={() => navigate(`/gatherings/${flow.id}`)}
          style={{
            background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
            padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.3, flex: 1 }}>
              {flow.title || flow.theme || 'Untitled Flow'}
            </div>
            {statusPill(flow.status)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {seriesOf(flow) && (
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
                {seriesOf(flow)}
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
              {flow.date ? `📅 ${formatDate(flow.date)}` : 'date not filed'}
            </span>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
              {ageDays !== undefined ? `${ageDays} day${ageDays === 1 ? '' : 's'} in queue` : 'date not filed'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {exit.failing.map((label) => (
              <span key={label} style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--status-blocked, #B3543F)' }}>
                — {label}
              </span>
            ))}
          </div>
          {depantyMove && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-secondary, #6B5F7A)' }}>
              📋 {depantyMove.title}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommunityEventsView({ defaultTab = 'upcoming' }: { defaultTab?: Tab } = {}) {
  const { data } = useDashboard();
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // The tab input is watched, not only seeded (spec D): when the
  // caller changes it while this view is mounted — an in-app link to
  // /gatherings?tab=workshops followed from inside Gatherings — the
  // visible tab changes to match.
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const allFlows = data.coFlowDates ?? [];
  const podyaps       = allFlows.filter(isPodyap);
  const groupFlows    = allFlows.filter(isGroupEvent);

  // The board's population (packet K §3, as amended A6): the
  // community-flows slice plus every row whose seriesOf
  // resolves, falling back to all flows when the union is empty.
  const upcomingFlows = boardPopulation(allFlows);
  const podyapFlows   = (podyaps.length > 0 ? podyaps : []);
  const groupFlowsFinal = (groupFlows.length > 0 ? groupFlows : []);

  return (
    <div className="cr-view" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Page header */}
      <div style={{ padding: '16px 16px 0', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.2 }}>
          Gatherings
        </div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)', marginTop: 2 }}>
          Podyaps · Book Club · Workshops · Wellshops
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '0 16px',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              minHeight: 44,
              padding: '10px 12px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--cr8w-primary, #7BA89D)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? 'var(--cr8w-primary, #7BA89D)' : 'var(--text-muted, #8A7060)',
              fontFamily: 'var(--font-label)',
              fontSize: '0.72rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        {activeTab === 'upcoming'  && <BoardTab     flows={upcomingFlows} />}
        {activeTab === 'depanty'   && <DepantyTab   flows={allFlows} tasks={data.tasks ?? []} syncStatus={data.syncStatus} />}
        {activeTab === 'podyaps'   && <PodyapsTab   flows={podyapFlows} />}
        {activeTab === 'workshops' && <WorkshopsTab flows={groupFlowsFinal} />}
        {activeTab === 'moves'     && <MovesTab     tasks={data.tasks ?? []} />}
        {activeTab === 'team'      && <TeamTab />}
      </div>
    </div>
  );
}
