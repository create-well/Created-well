// The .ts extension is deliberate: tsconfig allows it, Vite resolves
// it, and the repo's node test loader requires it for lib-to-lib
// value imports (extensionless resolves only under the bundler).
import { freshnessBand, type FreshnessBand } from './freshnessLabel.ts';

/**
 * CMS consumer data layer (G-11 consumer port, Track FE-6).
 *
 * The ONLY read path for released content inside createdwell is the
 * public connector route, /api/public-content — the same bytes the
 * public gets. No consumer ever falls back to a private Notion read
 * or a cached private copy (build packet §4, hard rule).
 *
 * Failure shape (Flag 3): a failed fetch, a 503, or a malformed
 * envelope yields the explicit unavailable state — never an empty
 * release, never "nothing released yet." A release whose generatedAt
 * derives Stale at render is likewise not presented as current: the
 * surface shows the unavailable state with the stale context visible
 * (a Stale label is shown, never hidden).
 */

export interface PublicContentItem {
  name: string;
  link: string | null;
  contentType: string | null;
  publishDate: string | null;
  where: string | null;
  tag: string | null;
}

export type ReleaseState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ok'; releaseId: string | null; generatedAt: Date | null; items: PublicContentItem[] };

export const RELEASE_UNAVAILABLE = 'release state unavailable';

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function fetchPublicContent(): Promise<ReleaseState> {
  try {
    const response = await fetch('/api/public-content', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return { kind: 'unavailable' };
    const envelope = (await response.json()) as {
      releaseId?: unknown; generatedAt?: unknown; items?: unknown;
    };
    if (!Array.isArray(envelope.items)) return { kind: 'unavailable' };
    const items: PublicContentItem[] = [];
    for (const raw of envelope.items as Record<string, unknown>[]) {
      const name = typeof raw?.name === 'string' ? raw.name : '';
      if (!name) continue;
      items.push({
        name,
        link: stringOrNull(raw.link),
        contentType: stringOrNull(raw.contentType),
        publishDate: stringOrNull(raw.publishDate),
        where: stringOrNull(raw.where),
        tag: stringOrNull(raw.tag),
      });
    }
    const generatedRaw = stringOrNull(envelope.generatedAt);
    const generatedAt = generatedRaw ? new Date(generatedRaw) : null;
    return {
      kind: 'ok',
      releaseId: stringOrNull(envelope.releaseId),
      generatedAt: generatedAt && Number.isFinite(generatedAt.getTime()) ? generatedAt : null,
      items,
    };
  } catch {
    return { kind: 'unavailable' };
  }
}

/**
 * FLAG 1: the rendered freshness derives at render time from the
 * envelope's generatedAt (Fresh ≤ 120s · Aging ≤ 15 min · Stale
 * beyond — the freshnessLabel family). The envelope's own freshness
 * field is informational only and is never read here.
 */
export function releaseBand(state: ReleaseState): FreshnessBand | null {
  if (state.kind !== 'ok') return null;
  return freshnessBand(state.generatedAt);
}

/** A release is presentable only when it loaded and is not Stale. */
export function releasePresentable(state: ReleaseState): boolean {
  return state.kind === 'ok' && releaseBand(state) !== 'Stale';
}

/**
 * The operational CONTENT working rows reach the dashboard normalized
 * as ForumPost rows whose `content` carries the row's Name, plus a
 * " [status]" suffix when the row has a URL (src/lib/notionNormalizer).
 * The join key is the name: strip the suffix to recover it. Duplicate
 * names collide — the known Phase 1 limitation, accepted in the build
 * packet; the first matching row wins.
 */
export function workingRowName(content: string): string {
  return content.replace(/ \[[^\]]*\]\s*$/, '').trim();
}

export function matchWorkingRow<T extends { content: string }>(
  rows: readonly T[],
  itemName: string,
): T | undefined {
  return rows.find((row) => workingRowName(row.content) === itemName);
}

/** Guarded short date for item rows: "Oct 27", or the §4 wording. */
export function itemDateLabel(publishDate: string | null): string {
  if (!publishDate) return 'Date not set yet.';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(publishDate)
    ? new Date(`${publishDate}T00:00:00`)
    : new Date(publishDate);
  if (!Number.isFinite(d.getTime())) return 'Date not set yet.';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
