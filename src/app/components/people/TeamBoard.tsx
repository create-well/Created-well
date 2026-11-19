import React from 'react';

// Phase 3 leg L4 fills this panel (packet M §2.4). Holding shape:
// the tab exists and routes; the board and the rehoused Team
// check-in filing form land in their own leg.
export function TeamBoard() {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #6B5F7A)' }}>
      Team
    </div>
  );
}
