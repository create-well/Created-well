import { fullPageId } from './contentFlowRelation.ts';

/** Proposed internal read-only projection. It is not a source of truth. */
export type SnapshotRelation = Readonly<{ ids: readonly string[]; complete: boolean }> | null;
export type SnapshotRow = Readonly<{
  notionPageId: string;
  content: string;
  flowRelation: SnapshotRelation;
}>;
export type ContentFlowSnapshot =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'empty'; rows: readonly SnapshotRow[] }>
  | Readonly<{ status: 'partial' | 'available'; rows: readonly SnapshotRow[] }>;
export type SnapshotInput =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; rows: readonly unknown[]; complete: boolean };

/**
 * Call only with a separately supplied successful CONTENT source response, before
 * optimistic forum state can mutate it. The caller must not treat transport 200
 * as source success when sourceErrors.content exists. `complete` covers the
 * source query, not the completeness of individual relation properties.
 */
export function makeContentFlowSnapshot(input: SnapshotInput): ContentFlowSnapshot {
  if (input.status === 'loading') return Object.freeze({ status: 'loading' });
  if (input.status === 'error') return Object.freeze({ status: 'error' });
  let complete = input.complete === true;
  const seen = new Set<string>();
  const rows: SnapshotRow[] = [];
  for (const value of input.rows) {
    if (!value || typeof value !== 'object') { complete = false; continue; }
    const row = value as { notionPageId?: unknown; content?: unknown; flowRelation?: unknown };
    const id = fullPageId(row.notionPageId);
    if (!id || seen.has(id) || typeof row.notionPageId !== 'string' || typeof row.content !== 'string') { complete = false; continue; }
    seen.add(id);
    let relation: SnapshotRelation = null;
    const rawRelation = row.flowRelation && typeof row.flowRelation === 'object'
      ? row.flowRelation as { ids?: unknown; complete?: unknown } : null;
    if (rawRelation && Array.isArray(rawRelation.ids)) {
      let relationComplete = rawRelation.complete === true;
      const ids: string[] = [];
      const seenFlows = new Set<string>();
      for (const candidate of rawRelation.ids) {
        const key = fullPageId(candidate);
        if (!key || typeof candidate !== 'string') { relationComplete = false; continue; }
        if (!seenFlows.has(key)) { seenFlows.add(key); ids.push(candidate); }
      }
      relation = Object.freeze({ ids: Object.freeze(ids), complete: relationComplete });
      if (!relationComplete) complete = false;
    } else {
      complete = false;
    }
    rows.push(Object.freeze({ notionPageId: row.notionPageId, content: row.content, flowRelation: relation }));
  }
  const immutableRows = Object.freeze(rows);
  return Object.freeze({ status: !complete ? 'partial' : rows.length ? 'available' : 'empty', rows: immutableRows });
}

/** Adapt only the primary response before it enters mutable forum state. */
export function snapshotFromDashboard(data: unknown, usedFallback: boolean): ContentFlowSnapshot {
  if (usedFallback || !data || typeof data !== 'object') return makeContentFlowSnapshot({ status: 'error' });
  const payload = data as { sourceErrors?: unknown; contentQueryComplete?: unknown; forum?: unknown };
  const errors = payload.sourceErrors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors) ||
      Object.prototype.hasOwnProperty.call(errors, 'content') || !Array.isArray(payload.forum)) {
    return makeContentFlowSnapshot({ status: 'error' });
  }
  return makeContentFlowSnapshot({ status: 'success', rows: payload.forum, complete: payload.contentQueryComplete === true });
}
