import React, { useState } from 'react';
import { FlowCommandCenter } from '../FlowCommandCenter';
import type { CoFlowDate } from '../api';
import { flowHeading } from '../../../lib/flows';
import { eventDateLabel, calendarDayDiff } from '../../../lib/dateLabel';

// ── Sessions strip (Phase 4, packet T) ──────────────────────────────────────
// The /making page's slim answer to "when do we record next": the next
// upcoming Podyap session (the old page's upcoming filter — date >=
// today, earliest first) named by its flow heading, or the honest
// no-session line. The Preflight collapsible (Omar's Operations Room)
// lives here, mirroring the old page's local-useState open/closed
// pattern.

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return calendarDayDiff(today, target);
}

export function SessionsStrip({ sessions }: { sessions: CoFlowDate[] }) {
  const [showPreflight, setShowPreflight] = useState(false);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = sessions
    .filter(p => new Date(p.date + 'T00:00:00') >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const nextDays = next ? daysUntil(next.date) : null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: 'var(--cr8w-card-bg, #F4F1ED)',
        border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {next ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--text-muted)', marginBottom: 3,
              }}>
                Next podyap session
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700,
                color: 'var(--cr8w-text, #2D2438)',
              }}>
                {flowHeading(next)}
              </div>
              <div style={{
                fontFamily: 'var(--font-label)', fontSize: '0.68rem',
                color: 'var(--text-muted)', marginTop: 3,
                display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                <span>📆 {eventDateLabel(next.date)}</span>
                {next.timeRange && <span>🕐 {next.timeRange}</span>}
                {next.location && <span>📍 {next.location}</span>}
                {nextDays !== null && nextDays <= 7 && (
                  <span style={{ color: '#7BA89D', fontWeight: 600 }}>
                    {nextDays === 0 ? 'Today!' : `${nextDays}d away`}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowPreflight(v => !v)}
              style={{
                flexShrink: 0,
                padding: '7px 14px', borderRadius: 8,
                border: showPreflight
                  ? '1.5px solid #C25B38'
                  : '1px solid var(--border-soft, rgba(196,164,132,0.25))',
                background: showPreflight ? 'rgba(194,91,56,0.06)' : '#fff',
                color: showPreflight ? '#C25B38' : 'var(--cr8w-text, #2D2438)',
                fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              ⚡ Preflight {showPreflight ? '▲' : '▼'}
            </button>
          </>
        ) : (
          <>
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: 'var(--font-body)', fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}>
              No podyap session scheduled.
            </div>
            <button
              onClick={() => setShowPreflight(v => !v)}
              style={{
                flexShrink: 0,
                padding: '7px 14px', borderRadius: 8,
                border: showPreflight
                  ? '1.5px solid #C25B38'
                  : '1px solid var(--border-soft, rgba(196,164,132,0.25))',
                background: showPreflight ? 'rgba(194,91,56,0.06)' : '#fff',
                color: showPreflight ? '#C25B38' : 'var(--cr8w-text, #2D2438)',
                fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              ⚡ Preflight {showPreflight ? '▲' : '▼'}
            </button>
          </>
        )}
      </div>

      {showPreflight && (
        <div style={{ marginTop: 16 }}>
          <FlowCommandCenter />
        </div>
      )}
    </div>
  );
}
