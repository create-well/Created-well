import React from 'react';
import { Link, useParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { PERSONS, TASK_ROLES, formatDate } from '../components/data';
import type { CoFlowDate } from '../components/api';
import {
  seriesOf,
  resolveGathering,
  moneySliceState,
  gatheringWorkList,
  depantyExitTest,
} from '../../lib/flows';

// ── Gathering detail (Phase 2a, packet K §4) ────────────────────────────────
// One gathering, everything attached on one page: header, basics
// and public side, people, the work list joined on the Flow
// relation, the money slice from the row's own rollups, capture,
// and the depanty checklist as read-only state, reading the
// one named exit test since Phase 2b. This page is the detail
// pattern Phase 3 copies for People, so its section order is
// fixed: header, basics, people, work, money, capture, depanty.
// Not-found is gated on settle (amendment A2): while the payload
// is unsettled this page renders loading, never a false
// not-found and never another gathering's data.

const FLOW_STATUS_WORDS: Record<string, string> = {
  idea: 'Idea', ready: 'Ready', approved: 'Approved', scheduled: 'Scheduled',
  happened: 'Happened', wrapped: 'Wrapped', cancelled: 'Cancelled',
};

const TASK_STATUS_WORDS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  dropped: 'Dropped',
};

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
      color: 'var(--text-muted, #8A7060)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 8,
    }}>{children}</div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
      padding: '14px 16px',
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

function GatheringDetail({ flow }: { flow: CoFlowDate }) {
  const { data } = useDashboard();
  const series = seriesOf(flow);
  const hostPerson = flow.host ? PERSONS[flow.host] : null;
  const work = gatheringWorkList(data.tasks ?? [], flow);
  const money = moneySliceState(flow);
  const notes = flow.sessionNotes || flow.notes;
  // Phase 2b: the checklist reads the one named exit test
  // (packet L §2), so the detail and the depanty queue can never
  // disagree about what "closed out" means.
  const exit = depantyExitTest(flow, data.tasks ?? []);

  const checklist: { done: boolean; label: string }[] = [
    { done: exit.numbers.pass, label: exit.numbers.pass ? 'Numbers recorded' : exit.numbers.label },
    { done: exit.followUps.pass, label: exit.followUps.pass ? 'Follow-ups owned and dated' : exit.followUps.label },
    { done: exit.retro.pass, label: exit.retro.pass ? 'Retro filed' : exit.retro.label },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.25 }}>
          {flow.title || flow.theme || 'Untitled Flow'}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
          {series && <span>{series}</span>}
          {flow.stage && <span>🌊 {flow.stage}</span>}
          <span>{FLOW_STATUS_WORDS[flow.status] ?? flow.status}</span>
          <span>📅 {flow.date ? formatDate(flow.date) : 'Date not set yet.'}{flow.timeRange ? ` · ${flow.timeRange}` : ''}</span>
          {flow.location && flow.location !== 'TBD' && <span>📍 {flow.location}</span>}
          {hostPerson && <span style={{ color: hostPerson.color }}>{hostPerson.emoji} {hostPerson.name}</span>}
        </div>
        <div style={{ marginTop: 8 }}>
          <Link
            to={`/gatherings/${flow.id}/day-of`}
            style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
          >
            Run the day →
          </Link>
        </div>
      </div>

      {/* Basics and public side */}
      <DetailSection title="Basics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55 }}>
          {flow.theme && flow.title && flow.theme !== flow.title && <div>{flow.theme}</div>}
          {flow.notes && <div>{flow.notes}</div>}
          {!flow.theme && !flow.notes && <div>Nothing filed yet.</div>}
          {flow.partifulLink && (
            <div>
              <a
                href={flow.partifulLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
              >
                RSVP on Partiful ↗
              </a>
            </div>
          )}
        </div>
      </DetailSection>

      {/* People */}
      <DetailSection title="People">
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55 }}>
          {typeof flow.attendeesActual === 'number' && (
            <div>{flow.attendeesActual} {flow.attendeesActual === 1 ? 'person' : 'people'} came</div>
          )}
          {flow.attendedNames && flow.attendedNames.length > 0 && (
            <div>{flow.attendedNames.join(', ')}</div>
          )}
          {typeof flow.attendeesActual !== 'number' && (!flow.attendedNames || flow.attendedNames.length === 0) && (
            <div>No attendance filed yet.</div>
          )}
        </div>
      </DetailSection>

      {/* Work list */}
      <DetailSection title="Work for this gathering">
        {work.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)' }}>
            No work linked to this gathering yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {work.map((t) => {
              const role = t.person ? TASK_ROLES[t.person] : undefined;
              const owner = role ? role.name : t.person;
              return (
                <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--cr8w-text, #2D2438)' }}>{t.title}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-label)', fontSize: '0.7rem', color: 'var(--text-muted, #8A7060)' }}>
                    {owner ? <span>{owner}</span> : null}
                    {t.priority ? <span className={`gcc-priority-badge ${t.priority}`}>{t.priority}</span> : null}
                    <span>{TASK_STATUS_WORDS[t.status] ?? t.status}</span>
                    <span>{t.due_date ? formatDate(t.due_date) : 'No date yet.'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      {/* Money slice */}
      <DetailSection title="Money">
        {money.kind === 'numbers' ? (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)' }}>
            In {usd(money.in)} · Out {usd(money.out)}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55 }}>
            Numbers for this gathering are kept in the bookkeeping workbook.
          </div>
        )}
      </DetailSection>

      {/* Capture and notes */}
      <DetailSection title="Capture">
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {notes || 'Nothing captured yet.'}
        </div>
      </DetailSection>

      {/* Depanty checklist, read-only state */}
      <DetailSection title="Depanty checklist">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checklist.map((item) => (
            <li key={item.label} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-secondary, #6B5F7A)' }}>
              {item.done ? '✓' : '—'} {item.label}
            </li>
          ))}
        </ul>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted, #8A7060)', marginTop: 8 }}>
          State only. The close-out queue lives in Gatherings → Depanty.
        </div>
      </DetailSection>
    </div>
  );
}

export function GatheringDetailPage() {
  const { id } = useParams();
  const { data, actions } = useDashboard();
  const numericId = Number(id);
  const resolution = resolveGathering(data.coFlowDates, data.syncStatus, numericId);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <div style={{ padding: '16px 0 12px' }}>
        <Link
          to="/gatherings"
          style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
        >
          ← Gatherings
        </Link>
      </div>

      {data.syncStatus === 'stale' && resolution.state === 'found' && (
        <p className="home-stale-marker" style={{ marginBottom: 12 }}>
          Last-good read — not a live read.
        </p>
      )}

      {resolution.state === 'loading' && (
        data.syncStatus === 'failed' ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary, #6B5F7A)', marginBottom: 12 }}>
              This gathering could not be loaded.
            </div>
            <button
              onClick={() => actions.retrySync()}
              style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div style={{ padding: '36px 24px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary, #6B5F7A)' }}>
            Loading this gathering…
          </div>
        )
      )}

      {resolution.state === 'not-found' && (
        <div style={{ padding: '36px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--cr8w-text, #2D2438)', marginBottom: 6 }}>
            This gathering is not on the board.
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted, #8A7060)' }}>
            It may have been removed, or the link is wrong.
          </div>
        </div>
      )}

      {resolution.state === 'found' && <GatheringDetail flow={resolution.flow} />}
    </div>
  );
}
