import React from 'react';

// Phase 3 leg L3 fills this panel (packet M §2.3). Holding shape:
// the tab exists and routes; the computed queue lands in its own leg.
export function FollowUpOwed() {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #6B5F7A)' }}>
      Follow-Up Owed
    </div>
  );
}
