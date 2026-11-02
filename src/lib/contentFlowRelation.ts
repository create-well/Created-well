/** Internal CONTENT → FLOWS relation only. Never use in the public projection. */
export interface ContentFlowRelation {
  ids: string[];
  complete: boolean;
}

/** Accept only full Notion page UUIDs; do not join on shortened display IDs. */
export function fullPageId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value)) return null;
  return compact.toLowerCase();
}

/** Missing/wrong-type properties are unknown, not empty. Truncated lists remain partial. */
export function readContentFlowRelation(property: unknown): ContentFlowRelation | null {
  if (!property || typeof property !== 'object') return null;
  const p = property as { type?: unknown; relation?: unknown; has_more?: unknown };
  if (p.type !== 'relation' || !Array.isArray(p.relation)) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  let complete = p.has_more === false;
  for (const entry of p.relation) {
    const raw = entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : null;
    const key = fullPageId(raw);
    if (!key || typeof raw !== 'string') { complete = false; continue; }
    if (!seen.has(key)) { seen.add(key); ids.push(raw); }
  }
  return { ids, complete };
}

export function flowPageUrl(id: string): string | null {
  const full = fullPageId(id);
  return full ? `https://app.notion.com/p/${full}` : null;
}

/** Preserve one entry per canonical CONTENT page, without an Events join. */
export function workingContentRows<T extends { notionPageId?: string }>(rows: readonly T[]): T[] {
  return rows.filter(row => Boolean(row.notionPageId));
}
