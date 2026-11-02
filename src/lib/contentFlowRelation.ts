// The relation reader's canonical home is notionNormalizer.ts: the API
// function graph loads that module and cannot carry a runtime `.ts`
// import specifier (production boot failure, 2026-11-02). This module
// re-exports it for the client and test graphs; do not move it back.
import { fullPageId } from './notionNormalizer.ts';
export { fullPageId, readContentFlowRelation, type ContentFlowRelation } from './notionNormalizer.ts';

export function flowPageUrl(id: string): string | null {
  const full = fullPageId(id);
  return full ? `https://app.notion.com/p/${full}` : null;
}

/** Preserve one entry per canonical CONTENT page, without an Events join. */
export function workingContentRows<T extends { notionPageId?: string }>(rows: readonly T[]): T[] {
  return rows.filter(row => Boolean(row.notionPageId));
}
