import { useMemo } from 'react';
import type { CalendarEventKV, CoFlowDate } from './api';
import { buildAgenda } from '../../lib/calendarAgenda';

/**
 * FE-12 — the shared team calendar as a native agenda list.
 * Replaces the Google Calendar embed iframe in HubView's Calendar
 * tab (Layer 1). The grouping logic lives in lib/calendarAgenda;
 * this component only renders it, in dashboard tokens. Honest
 * states in words: loading while the KV read is in flight, and an
 * explicit empty sentence when the next two weeks carry nothing.
 */
export default function CalendarAgenda({
  kvEvents,
  coFlowDates,
  loaded,
}: {
  kvEvents: CalendarEventKV[];
  coFlowDates: CoFlowDate[];
  loaded: boolean;
}) {
  const days = useMemo(() => buildAgenda(kvEvents, coFlowDates, new Date()), [kvEvents, coFlowDates]);

  if (!loaded) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
        Loading the team calendar…
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
        Nothing on the team calendar in the next two weeks.
      </div>
    );
  }

  return (
    <div className="calendar-agenda">
      {days.map(day => (
        <div key={day.key} style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'var(--cr8w-primary-text, #964226)', marginBottom: 5,
          }}>
            {day.rel ? `${day.rel} · ` : ''}{day.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {day.rows.map(row => (
              <div key={row.key} style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '6px 9px', borderRadius: 8,
                background: 'rgba(var(--cr8w-primary-rgb, 123,168,157),0.05)',
              }}>
                {row.time && (
                  <span style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                    color: 'var(--text-secondary, #443855)', whiteSpace: 'nowrap', minWidth: 64,
                  }}>{row.time}</span>
                )}
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                  color: 'var(--cr8w-text, #2C1C10)', flex: 1, lineHeight: 1.35,
                }}>{row.title}</span>
                {row.location && (
                  <span style={{
                    fontFamily: 'var(--font-label)', fontSize: '0.7rem',
                    color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  }}>{row.location}</span>
                )}
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
                  letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 8,
                  border: '1px solid var(--border-soft)', color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>{row.tag}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{
        fontFamily: 'var(--font-label)', fontSize: '0.66rem', color: 'var(--text-muted)',
        marginTop: 2,
      }}>
        Team calendar, synced from the shared Google Calendar. Sync Calendar above refreshes it.
      </div>
    </div>
  );
}
