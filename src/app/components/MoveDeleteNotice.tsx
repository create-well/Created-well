import React from 'react';

/** Persistent, non-sensitive feedback. A failed response does not prove source rollback. */
export function MoveDeleteNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside aria-label="Move deletion notice" style={{
      position: 'fixed', bottom: 'max(16px, env(safe-area-inset-bottom))',
      left: 16, right: 16, maxWidth: 480, marginInline: 'auto', zIndex: 10000,
      boxSizing: 'border-box', padding: 16, borderRadius: 16,
      background: '#F6EBDF', color: '#2D2438', border: '2px solid #A34C2F',
      boxShadow: '0 4px 20px rgba(45,36,56,0.16)',
      fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: 16, lineHeight: 1.5,
    }}>
      <p role="alert" aria-atomic="true" style={{ margin: '0 0 12px', overflowWrap: 'anywhere' }}>
        Delete not confirmed. Refresh to check this Move before trying again.
      </p>
      <button type="button" onClick={onDismiss} style={{
        minHeight: 44, minWidth: 44, padding: '8px 16px', borderRadius: 10,
        border: '2px solid #2D2438', background: '#A34C2F', color: '#fff',
        font: 'inherit', fontWeight: 600, cursor: 'pointer',
      }}>Dismiss</button>
    </aside>
  );
}
