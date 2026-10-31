import React from 'react';
import { usePublicContent } from '../../lib/usePublicContent';
import { releaseBand, releasePresentable } from '../../lib/publicContent';
import { ReleaseStateBlock } from './ReleaseStateBlock';

/**
 * Consumer 2 (G-11 port): Podyap / Journal release status inside the
 * content workflow — released vs held, from the connector's items +
 * count alone. The released set is named; anything not named is not
 * in the public release. No per-card markers: the workflow's rows
 * (CoFlow dates) carry session titles, not content names, so a name
 * join there would fabricate precision the data does not hold.
 */
export function ReleaseStatusStrip() {
  const state = usePublicContent();

  if (!releasePresentable(state)) {
    return (
      <div style={{
        background: 'var(--cr8w-card-bg, #F4F1ED)', border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
        borderRadius: 12, padding: '4px 14px', marginBottom: 20,
      }}>
        <ReleaseStateBlock state={state} />
      </div>
    );
  }
  if (state.kind !== 'ok') return null;

  const band = releaseBand(state);
  return (
    <div style={{
      background: 'var(--cr8w-card-bg, #F4F1ED)', border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
      borderRadius: 12, padding: '10px 14px', marginBottom: 20,
    }}>
      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Public release · {state.items.length} released · {band ?? ''}
        {state.generatedAt
          ? ` · generated ${state.generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          : ''}
      </div>
      {state.items.length > 0 ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--cr8w-text, #2D2438)', marginTop: 5, lineHeight: 1.55 }}>
          {state.items.map((item) => item.name).join(' · ')}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 5 }}>
          The current release is empty — nothing is public right now.
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 5 }}>
        Anything not listed here is not in the public release.
      </div>
    </div>
  );
}
