import React from 'react';

// Phase 3 leg L2 fills this panel (packet M §2.1). Holding shape:
// the tab exists and routes; the list lands in its own leg.
export function EveryoneList() {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #6B5F7A)' }}>
      Everyone
    </div>
  );
}
