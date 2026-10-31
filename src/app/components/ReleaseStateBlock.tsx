import React from 'react';
import { RELEASE_UNAVAILABLE, type ReleaseState } from '../../lib/publicContent';

/**
 * The Flag 3 degraded render, shared by every CMS consumer surface:
 * the explicit unavailable state — never an empty-as-truth render,
 * never a private fallback. When the release loaded but derives
 * Stale at render, the stale context stays visible beside it (a
 * Stale label is shown, never hidden).
 */
export function ReleaseStateBlock({ state }: { state: ReleaseState }) {
  if (state.kind === 'loading') {
    return (
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px 0' }}>
        Loading release state…
      </div>
    );
  }
  const staleAt = state.kind === 'ok' ? state.generatedAt : null;
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{
        fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)', textTransform: 'capitalize',
      }}>
        {RELEASE_UNAVAILABLE}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
        The public release could not be read as current. Nothing here falls back to a private copy.
        {staleAt && (
          <> Last release generated {staleAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Stale.</>
        )}
      </div>
    </div>
  );
}
