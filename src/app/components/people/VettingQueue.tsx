import React from 'react';

// ── Vetting (Phase 3, packet M §2.5) ─────────────────────────────────────────
// The Playd8s vetting queue. Intake (Form A capture) has no database home
// yet — that homing is gated item G2, owned elsewhere — so the panel
// builds its full surface contract around the honest empty state. No
// write affordances: this phase's queue has no move-a-stage action a
// button could honestly own, so it renders none.

// Packet I's eight stages, in order. These display forms shorten the
// process draft's stage names; they are reference vocabulary, not
// state, and nothing here claims any candidate sits in any stage.
const STAGES = [
  'Arrival',
  'First response',
  'Alignment screen',
  'Ideation read',
  'Triage',
  'Shape call',
  'Terms',
  'Schedule',
] as const;

export function VettingQueue() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)',
      }}>
        Vetting
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.85rem',
        color: 'var(--text-muted, #6B5F7A)',
      }}>
        Collaborator, partner, sponsor, and workshop host-teacher candidates,
        worked through the Playd8s stages.
      </div>

      <div style={{
        fontFamily: 'var(--font-label)', fontSize: '0.72rem',
        color: 'var(--text-muted, #6B5F7A)',
        display: 'flex', flexWrap: 'wrap',
      }}>
        {STAGES.map((stage, i) => (
          <span key={stage} style={{ whiteSpace: 'nowrap' }}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {stage}
          </span>
        ))}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.85rem',
        color: 'var(--text-muted, #6B5F7A)',
      }}>
        No candidates in the queue. Rows land here when intake is homed.
      </div>
    </div>
  );
}
