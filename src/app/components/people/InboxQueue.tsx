import React from 'react';

// Phase 3 leg L5 fills this panel (packet M §2.6). Holding shape:
// the tab exists and routes; the queue, its honest empty state, and
// the Open Asks counts tile land in their own leg.
export function InboxQueue() {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-muted, #6B5F7A)' }}>
      Inbox
    </div>
  );
}
