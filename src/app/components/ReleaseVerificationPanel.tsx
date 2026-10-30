import React from 'react';
import { usePublicContent } from '../../lib/usePublicContent';
import {
  releaseBand, releasePresentable, matchWorkingRow, itemDateLabel,
} from '../../lib/publicContent';
import { ReleaseStateBlock } from './ReleaseStateBlock';

/**
 * Consumer 1 (G-11 port): the release verification view — what the
 * public gets, read from the connector route itself, joined against
 * the operational CONTENT working rows (the dashboard's forum rows,
 * whose content carries each row's Name) on the name key. The view is
 * never sourced from the connector alone: every released item shows
 * whether a working row matches it. Duplicate names collide (known
 * Phase 1 limitation, accepted in the build packet).
 */
export function ReleaseVerificationPanel({ workingRows }: { workingRows: readonly { content: string }[] }) {
  const state = usePublicContent();

  if (!releasePresentable(state)) {
    return <ReleaseStateBlock state={state} />;
  }
  // releasePresentable narrows the union for the checks above; re-narrow
  // for TypeScript.
  if (state.kind !== 'ok') return <ReleaseStateBlock state={state} />;

  const band = releaseBand(state);
  const matched = state.items.filter((item) => matchWorkingRow(workingRows, item.name)).length;

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline',
        fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted)',
        padding: '6px 0 10px',
      }}>
        <span>Release {state.releaseId ?? '—'}</span>
        <span>·</span>
        <span>
          generated {state.generatedAt
            ? state.generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : '—'}
        </span>
        <span>·</span>
        <span>{band ?? ''}</span>
        <span>·</span>
        <span>{state.items.length} released · {matched} matched to working rows</span>
      </div>
      {state.items.length === 0 && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingBottom: 8 }}>
          The current release is empty — nothing is public right now.
        </div>
      )}
      {state.items.map((item) => {
        const row = matchWorkingRow(workingRows, item.name);
        return (
          <div
            key={item.name}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
              padding: '8px 0', borderTop: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
            }}
          >
            <div style={{ minWidth: 0 }}>
              {item.link ? (
                <a
                  href={item.link} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, color: 'var(--cr8w-primary)', textDecoration: 'none' }}
                >
                  {item.name}
                </a>
              ) : (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.84rem', fontWeight: 600, color: 'var(--cr8w-text, #2D2438)' }}>
                  {item.name}
                </span>
              )}
              <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {[item.contentType, itemDateLabel(item.publishDate), item.where, item.tag]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '0.66rem', fontWeight: 600, whiteSpace: 'nowrap',
              color: row ? 'var(--cr8w-primary)' : 'var(--text-muted)',
            }}>
              {row ? 'working row ✓' : 'no working-row match'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
