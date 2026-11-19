import React from 'react';
import { useDashboard } from '../../../contexts/DashboardContext';
import { openAsksCareValue } from '../../../lib/homePanels';

// ── Inbox (Phase 3, packet M §2.6) ───────────────────────────────────────────
// The door-and-inbox queue. The door rows belong to the same unhomed
// intake flow as the vetting queue (G2), so the queue renders its full
// surface contract around the honest empty state. The only live data
// here is the payload's counts-only OPEN ASKS aggregate (packet M §5):
// numbers, never the asks themselves. No rows are invented and nothing
// is borrowed from the PEOPLE or tasks slices as a facade population.

export function InboxQueue() {
  const { data } = useDashboard();
  const openAsksCare = openAsksCareValue(data.openAsksCare);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)',
      }}>
        Inbox
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.85rem',
        color: 'var(--text-muted, #6B5F7A)',
      }}>
        New rows from the door and the inbox, each routed or closed inside
        7 days with a destination and an owner.
      </div>

      {openAsksCare && (
        <section style={{
          background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
          padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-body)', fontSize: '0.82rem',
            color: 'var(--text-secondary, #4A3F55)',
          }}>
            <span>Unanswered asks</span>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--text-muted, #6B5F7A)', textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Open asks
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.82rem',
            color: 'var(--text-secondary, #4A3F55)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
              color: 'var(--cr8w-text, #2D2438)',
            }}>
              {openAsksCare.unanswered}
            </span>
            {' '}of {openAsksCare.total}
          </div>
        </section>
      )}

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.85rem',
        color: 'var(--text-muted, #6B5F7A)',
      }}>
        Nothing waiting. Rows land here when intake is homed.
      </div>
    </div>
  );
}
