import React from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../../contexts/DashboardContext';
import { PERSONS } from '../data';
import { followUpOwedQueue } from '../../../lib/followUps';

// ── Follow-Up Owed (Phase 3, packet M §2.3) ─────────────────────────────────
// Computed membership (lib/followUps): a filed Next Invitation or
// at least one open Follow-up Move. Rows carry what is owed with
// owner and date as filed — a Move with no owner or no date reads
// as itself, never dressed up. The honest zero is a sentence.

function ownerLabel(slug: string): string {
  const p = (PERSONS as Record<string, { name?: string }>)[slug];
  return p?.name ?? slug;
}

export function FollowUpOwed() {
  const { data } = useDashboard();
  const queue = followUpOwedQueue(data.stations, data.tasks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)',
      }}>
        Follow-Up Owed · {queue.length}
      </div>

      {queue.length === 0 && (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.85rem',
          color: 'var(--text-muted, #6B5F7A)',
        }}>
          No follow-ups owed.
        </div>
      )}

      {queue.map(entry => (
        <section
          key={entry.person.id}
          style={{
            background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <Link
            to={`/people/${entry.person.id}`}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600,
              color: 'var(--cr8w-text, #2D2438)', textDecoration: 'none',
            }}
          >
            {entry.person.name}
          </Link>

          {entry.moves.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 12, flexWrap: 'wrap',
                fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                color: 'var(--text-secondary, #4A3F55)',
              }}
            >
              <span>{m.title}</span>
              {m.person && <span>Owner: {ownerLabel(m.person)}</span>}
              {m.due_date && <span>Due: {m.due_date}</span>}
            </div>
          ))}

          {entry.unresolvedMoveCount > 0 && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              color: 'var(--text-secondary, #4A3F55)',
            }}>
              {entry.unresolvedMoveCount === 1
                ? 'A follow-up move'
                : `${entry.unresolvedMoveCount} follow-up moves`}
            </div>
          )}

          {entry.nextInvitation && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              color: 'var(--text-secondary, #4A3F55)',
            }}>
              Next invitation: {entry.nextInvitation}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
