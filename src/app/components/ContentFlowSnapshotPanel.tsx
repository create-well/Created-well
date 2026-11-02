import React from 'react';
import { flowPageUrl } from '../../lib/contentFlowRelation';
import type { ContentFlowSnapshot } from '../../lib/contentFlowSnapshot';

/** Presentational only: no network, context, mutations, or public CMS reader. */
export function ContentFlowSnapshotPanel({ snapshot, onRetry }: {
  snapshot: ContentFlowSnapshot;
  onRetry: () => void;
}) {
  return (
    <details className="card" open={snapshot.status === 'error' ? true : undefined} style={{ marginBottom: 16, padding: 16 }}>
      <summary>Content and linked Flows{snapshot.status === 'error' ? ' (unavailable)' : ''}</summary>
      <p>Internal working records. A link is not publication approval.</p>
      {snapshot.status === 'loading' && <p role="status">Loading content…</p>}
      {snapshot.status === 'error' && <div role="alert"><p>Content is unavailable. The source could not be read.</p><button type="button" onClick={onRetry}>Retry</button></div>}
      {snapshot.status === 'empty' && <p>No content records returned.</p>}
      {snapshot.status === 'partial' && <p role="status">Content or its Flow relations may be incomplete.</p>}
      {(snapshot.status === 'available' || snapshot.status === 'partial') && snapshot.rows.map(row => (
        <div key={row.notionPageId} style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 0', overflowWrap: 'anywhere' }}>
          <div>{row.content}</div>
          {row.flowRelation === null ? <div>Flow relation unavailable.</div> : <div>
            {row.flowRelation.ids.length === 0 && row.flowRelation.complete && <span>No linked Flow.</span>}
            {row.flowRelation.ids.map((id, index) => {
              const href = flowPageUrl(id);
              return href ? <div key={href}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open linked Flow ${index + 1} for ${row.content}`}>Open linked Flow {index + 1} ↗</a></div> : null;
            })}
            {!row.flowRelation.complete && <div>Relation may be incomplete.</div>}
          </div>}
        </div>
      ))}
    </details>
  );
}
