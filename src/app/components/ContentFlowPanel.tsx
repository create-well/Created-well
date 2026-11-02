import React from 'react';
import type { ForumPost } from './api';
import { flowPageUrl, workingContentRows, type ContentFlowRelation } from '../../lib/contentFlowRelation';

/** Internal working CONTENT only. No Events join and no public-release inference. */
export function ContentFlowPanel({ rows }: { rows: readonly ForumPost[] }) {
  const sourceRows = workingContentRows(rows);
  return (
    <details className="card" style={{ marginBottom: 16, padding: 16 }}>
      <summary>Content and linked Flows</summary>
      <p>Internal working records. A link is not publication approval.</p>
      {sourceRows.length === 0 && <p>No source rows returned, or content is unavailable.</p>}
      {sourceRows.map(row => {
        const relation = (row as ForumPost & { flowRelation?: ContentFlowRelation | null }).flowRelation;
        return (
          <div key={row.notionPageId} style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 0' }}>
            <div>{row.content}</div>
            {!relation ? <div>Flow relation unavailable.</div> : (
              <div>
                {relation.ids.length === 0 && relation.complete && <span>No linked Flow.</span>}
                {relation.ids.map((id, index) => {
                  const href = flowPageUrl(id);
                  return href ? <div key={href}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open linked Flow ${index + 1} for ${row.content}`}>Open linked Flow {index + 1} ↗</a></div> : null;
                })}
                {!relation.complete && <div>Relation may be incomplete.</div>}
              </div>
            )}
          </div>
        );
      })}
    </details>
  );
}
