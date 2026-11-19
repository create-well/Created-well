import React from 'react';

// Phase 3 leg L5 fills this panel (packet M §2.5). Holding shape:
// the tab exists and routes; the queue and its honest empty state
// land in their own leg.
export function VettingQueue() {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #6B5F7A)' }}>
      Vetting
    </div>
  );
}
