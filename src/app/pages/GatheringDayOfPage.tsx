import React, { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { localDateString } from '../../lib/dateLabel';
import { PERSONS, formatDate } from '../components/data';
import { checkInGuest, type CoFlowDate } from '../components/api';
import {
  seriesOf,
  resolveGathering,
  dayOfTimes,
  dayOfRunList,
  gearCheckState,
} from '../../lib/flows';

// ── Gathering day-of (Phase 2b, packet L §3–§6) ─────────────────────────────
// Mobile-first, one column, fixed order: header, door check-in,
// run list, role holders, gear check, capture. The header's time
// block follows §5's rule (dayOfTimes): EVENTS time while the
// sources disagree, flagged; the detail page keeps showing the
// FLOWS time. The door's checked state reads the FLOWS Attended
// relation; a tap writes through the §4.1 route and the surface
// updates only from the server's returned set — a local-only
// check-in state is forbidden (A4). Not-found is gated on
// settle, like the detail page (K amendment A2's shape).

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function DaySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <h2 style={{
        margin: 0, fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #8A7060)',
      }}>{title}</h2>
      {children}
    </section>
  );
}

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.85rem',
  color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55,
};
const labelText: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '0.78rem',
  color: 'var(--text-secondary, #6B5F7A)',
};

function DoorCheckIn({ flow }: { flow: CoFlowDate }) {
  const [attended, setAttended] = useState<string[]>(flow.attendedIds ?? []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A4's three door states, kept distinct: no event row linked,
  // event row linked with no guests filed yet, and the list.
  if (flow.eventGuests === undefined) {
    return <div style={bodyText}>No event row linked — door list unavailable</div>;
  }
  if (flow.eventGuests.length === 0) {
    return <div style={bodyText}>Event row linked, no guests filed yet</div>;
  }

  const onCheckIn = async (personId: string) => {
    if (!flow.notionPageId || pendingId) return;
    setPendingId(personId);
    setError(null);
    try {
      const next = await checkInGuest(flow.notionPageId, personId);
      setAttended(next);
    } catch {
      setError('Check-in did not reach Notion — try again.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {flow.eventGuests.map((guest) => {
        const checked = attended.includes(guest.id);
        return (
          <div key={guest.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={bodyText}>{guest.name}</span>
            <button
              type="button"
              disabled={checked || pendingId !== null}
              onClick={() => onCheckIn(guest.id)}
              style={{
                minHeight: 44, padding: '10px 16px', borderRadius: 10, border: 'none',
                fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 700,
                background: checked ? 'rgba(0,0,0,0.06)' : 'var(--cr8w-primary, #7BA89D)',
                color: checked ? 'var(--text-muted, #8A7060)' : '#fff',
                cursor: checked ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {checked ? 'Checked in ✓' : pendingId === guest.id ? 'Checking in…' : 'Check in'}
            </button>
          </div>
        );
      })}
      {error && <div style={{ ...labelText, color: 'var(--status-blocked, #B3543F)' }}>{error}</div>}
    </div>
  );
}

function DayOf({ flow }: { flow: CoFlowDate }) {
  const { data } = useDashboard();
  const tasks = data.tasks ?? [];
  const times = dayOfTimes(flow);
  const runList = dayOfRunList(flow, tasks);
  const gear = gearCheckState(flow, tasks);
  const hostPerson = flow.host ? PERSONS[flow.host] : null;
  const today = localDateString(new Date());
  const flowDay = (flow.date || '').slice(0, 10);
  const isToday = flowDay === today;
  const notes = flow.sessionNotes || flow.notes;

  const timeBlock = times.start
    ? times.source === 'events'
      ? `${formatTime(times.start)}${times.end ? ` – ${formatTime(times.end)}` : ''}`
      : flow.timeRange || formatTime(times.start)
    : 'Time not set yet.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.25 }}>
          {flow.title || flow.theme || 'Untitled Flow'}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontFamily: 'var(--font-label)', fontSize: '0.78rem', color: 'var(--text-muted, #8A7060)' }}>
          {seriesOf(flow) && <span>{seriesOf(flow)}</span>}
          <span>🕐 {timeBlock}</span>
          {flow.location && flow.location !== 'TBD' && <span>📍 {flow.location}</span>}
        </div>
        {times.conflict && times.flowsStart && (
          <div style={{ ...labelText, marginTop: 6, color: 'var(--status-blocked, #B3543F)' }}>
            FLOWS says {formatTime(times.flowsStart)} — unconfirmed
          </div>
        )}
        {!isToday && flowDay && (
          <div style={{ ...labelText, marginTop: 6 }}>
            Not today — this gathering is on {formatDate(flow.date)}.
          </div>
        )}
      </div>

      {/* Door check-in */}
      <DaySection title="Door check-in">
        <DoorCheckIn flow={flow} />
      </DaySection>

      {/* Run list */}
      <DaySection title="Run list">
        {runList.source === 'none' ? (
          <div style={bodyText}>No run list filed yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {runList.rows.map((row, i) => (
              <li key={`${row.text}-${i}`} style={bodyText}>
                {row.text}
                {row.detail ? <span style={{ color: 'var(--text-muted, #8A7060)' }}> · {row.detail}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </DaySection>

      {/* Role holders */}
      <DaySection title="Role holders">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={bodyText}>
            Flow Keeper — {hostPerson ? hostPerson.name : flow.host || 'Unfilled'}
          </div>
          <div style={bodyText}>Craft Lead — {flow.craftLead || 'Unfilled'}</div>
          <div style={bodyText}>Door — Unfilled</div>
          <div style={bodyText}>Capture — Unfilled</div>
          <div style={bodyText}>Money — Unfilled</div>
          <div style={bodyText}>Close — Unfilled</div>
        </div>
      </DaySection>

      {/* Gear and valve check */}
      <DaySection title="Gear and valve check">
        <div style={bodyText}>
          Omar's gear and valve check — {gear.state}
        </div>
      </DaySection>

      {/* Capture */}
      <DaySection title="Capture">
        <div style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>
          {notes || 'Nothing captured yet.'}
        </div>
      </DaySection>
    </div>
  );
}

export function GatheringDayOfPage() {
  const { id } = useParams();
  const { data, actions } = useDashboard();
  const numericId = Number(id);
  const resolution = resolveGathering(data.coFlowDates, data.syncStatus, numericId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
      <div style={{ padding: '16px 0 12px', display: 'flex', gap: 16 }}>
        <Link
          to="/gatherings"
          style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
        >
          ← Gatherings
        </Link>
        {resolution.state === 'found' && (
          <Link
            to={`/gatherings/${resolution.flow.id}`}
            style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
          >
            Gathering detail
          </Link>
        )}
      </div>

      {data.syncStatus === 'stale' && resolution.state === 'found' && (
        <p className="home-stale-marker" style={{ marginBottom: 12 }}>
          Last-good read — not a live read.
        </p>
      )}

      {resolution.state === 'loading' && (
        data.syncStatus === 'failed' ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ ...bodyText, marginBottom: 12 }}>
              This gathering could not be loaded.
            </div>
            <button
              type="button"
              onClick={() => actions.retrySync()}
              style={{
                minHeight: 44, padding: '10px 16px', borderRadius: 10, border: 'none',
                fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 700,
                background: 'var(--cr8w-primary, #7BA89D)', color: '#fff', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={{ padding: '36px 24px', textAlign: 'center', ...bodyText }}>
            Loading this gathering…
          </div>
        )
      )}

      {resolution.state === 'not-found' && (
        <div style={{ padding: '36px 24px', textAlign: 'center', ...bodyText }}>
          This gathering is not on the board.
        </div>
      )}

      {resolution.state === 'found' && <DayOf flow={resolution.flow} />}
    </div>
  );
}
