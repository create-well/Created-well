// Making (Phase 4, packets S/T): the CONTENT board derivations.
//
// Every function here is a pure projection over the forum slice
// (ForumPost rows as projected by normalizeContent). The board reads
// the team's own filed fields — Current Gate for episodes, Status for
// pieces, the Ready to Release? formula for the release-call queue —
// and derives nothing the fields do not say: a row with no gate filed
// lands in a named unfiled group, never in a guessed stage.
//
// The release gate stated here (Published + Public + Final?) mirrors
// the public projection's passesGate for DISPLAY on the detail page;
// the public projection itself is the only release authority and is
// untouched by this phase.

import type { ForumPost } from '../app/components/api';
import { workingRowName } from './publicContent.ts';

// The eight production gates, in the ops flow's order, spelled as the
// CONTENT Current Gate select spells them (verified 2026-11-19).
export const GATE_ORDER = [
  'Topic lock',
  'Record',
  'Rough cut',
  'Hero cut',
  'Taste',
  'Release',
  'Clips',
  'Promo',
] as const;

// Gate holders from the Podyap ops flow of record (P6 cross-check,
// 2026-11-19: names, order, and holders match the flow verbatim).
// Taste is an invitation, never an assignment; Promo is named per run.
export const GATE_HOLDERS: Record<string, string> = {
  'Topic lock': 'Monny',
  Record: 'Sunshine + Omar',
  'Rough cut': 'Omar',
  'Hero cut': 'Sunshine',
  Taste: 'Bingle — by invitation',
  Release: 'Monny',
  Clips: 'Pia',
  Promo: 'Named per run',
};

export const NO_GATE_LABEL = 'No gate filed';
export const INBOX_LABEL = 'Inbox — untriaged';
export const NO_STATUS_LABEL = 'No status filed';
export const RELEASED_LABEL = 'Released';

export function postName(post: ForumPost): string {
  return workingRowName(post.content ?? '');
}

export function isEpisode(post: ForumPost): boolean {
  return post.tag === 'Episode';
}

function byDateThenName(a: ForumPost, b: ForumPost): number {
  const da = a.publishDate ?? null;
  const db = b.publishDate ?? null;
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return postName(a).localeCompare(postName(b));
}

export interface MakingBoardGroup {
  label: string;
  posts: ForumPost[];
}

export interface MakingBoard {
  episodeGroups: MakingBoardGroup[];
  pieceGroups: MakingBoardGroup[];
  // Registry-mirror rows are CMS registry entries, not pieces; they
  // are excluded from every group and queue and counted here so the
  // board footer can say they exist.
  mirrorCount: number;
  // Archived rows (either set) leave the board the same way.
  archivedCount: number;
}

const PIECE_GROUP_ORDER: { label: string; match: (post: ForumPost) => boolean }[] = [
  { label: 'Draft', match: (p) => p.status === 'Draft' },
  { label: 'Ready', match: (p) => p.status === 'Ready' },
  { label: RELEASED_LABEL, match: (p) => p.status === 'Published' },
  { label: INBOX_LABEL, match: (p) => p.status === 'Inbox' },
  { label: NO_STATUS_LABEL, match: (p) => !p.status },
];

export function boardGroups(posts: ForumPost[]): MakingBoard {
  const mirrorCount = posts.filter((p) => p.registryMirror).length;
  const live = posts.filter((p) => !p.registryMirror);
  const archivedCount = live.filter((p) => p.status === 'Archived').length;
  const active = live.filter((p) => p.status !== 'Archived');

  const episodes = active.filter(isEpisode);
  const episodeGroups: MakingBoardGroup[] = [
    {
      label: NO_GATE_LABEL,
      posts: episodes.filter((p) => !p.currentGate).sort(byDateThenName),
    },
    ...GATE_ORDER.map((gate) => ({
      label: gate as string,
      posts: episodes.filter((p) => p.currentGate === gate).sort(byDateThenName),
    })),
  ];

  const pieces = active.filter((p) => !isEpisode(p));
  const pieceGroups: MakingBoardGroup[] = PIECE_GROUP_ORDER.map(({ label, match }) => ({
    label,
    posts: pieces.filter(match).sort(byDateThenName),
  }));

  return { episodeGroups, pieceGroups, mirrorCount, archivedCount };
}

export interface MakingQueue {
  dated: ForumPost[];
  undatedCount: number;
}

function splitByDate(rows: ForumPost[]): MakingQueue {
  const dated = rows.filter((p) => p.publishDate).sort(byDateThenName);
  return { dated, undatedCount: rows.length - dated.length };
}

// Waiting For Taste: rows filed at the Taste gate, any content type.
export function tasteQueue(posts: ForumPost[]): MakingQueue {
  return splitByDate(
    posts.filter((p) => !p.registryMirror && p.status !== 'Archived' && p.currentGate === 'Taste'),
  );
}

// Waiting For Release Call: the team's own Ready to Release? formula
// is true and the piece is not already Published. The formula itself
// requires a Publish Date, so members are dated by construction; the
// split stays honest regardless.
export function releaseCallQueue(posts: ForumPost[]): MakingQueue {
  return splitByDate(
    posts.filter(
      (p) =>
        !p.registryMirror &&
        p.status !== 'Archived' &&
        p.readyToRelease === true &&
        p.status !== 'Published',
    ),
  );
}

export interface GateLeg {
  key: 'published' | 'public' | 'final';
  label: string;
  actual: string;
  met: boolean;
}

export interface GateVerdict {
  legs: GateLeg[];
  passes: boolean;
  missing: string[];
}

// The three-leg release gate as the detail page states it: each leg
// shows the row's actual filed value, and the verdict names the unmet
// legs. This is a display derivation only.
export function gateVerdict(post: ForumPost): GateVerdict {
  const legs: GateLeg[] = [
    {
      key: 'published',
      label: 'Published',
      actual: post.status ?? 'Not filed',
      met: post.status === 'Published',
    },
    {
      key: 'public',
      label: 'Public',
      actual: post.audience ?? 'Not filed',
      met: post.audience === 'Public',
    },
    {
      key: 'final',
      label: 'Final',
      actual: post.isFinal ? 'Checked' : 'Not checked',
      met: post.isFinal === true,
    },
  ];
  return {
    legs,
    passes: legs.every((l) => l.met),
    missing: legs.filter((l) => !l.met).map((l) => l.label),
  };
}

export interface ReadinessLeg {
  label: string;
  met: boolean;
}

// The Ready to Release? formula's four legs, shown as readiness —
// distinct from the release gate's permission (the formula's own
// description draws the same line).
export function readinessLegs(post: ForumPost): ReadinessLeg[] {
  return [
    { label: 'Final? checked', met: post.isFinal === true },
    { label: 'Status is Ready', met: post.status === 'Ready' },
    { label: 'Link filed', met: !!post.link },
    { label: 'Publish Date filed', met: !!post.publishDate },
  ];
}

export function gateHolder(gate: string | null | undefined): string | null {
  if (!gate) return null;
  return GATE_HOLDERS[gate] ?? null;
}

export type PostResolution =
  | { state: 'loading' }
  | { state: 'found'; post: ForumPost }
  | { state: 'not-found' };

// Detail-page resolution in the Phase 3 resolvePerson shape: never a
// false not-found while the payload is unsettled; matches on the
// forum stableId, and also accepts the CONTENT page id.
export function resolvePost(
  posts: ForumPost[] | undefined,
  syncStatus: string,
  id: number | string,
): PostResolution {
  const settled = syncStatus === 'fresh' || syncStatus === 'stale';
  if (!settled) return { state: 'loading' };
  const numeric = typeof id === 'number' ? id : Number(id);
  const pageId = String(id);
  const post = (posts ?? []).find((p) => p.id === numeric || p.notionPageId === pageId);
  return post ? { state: 'found', post } : { state: 'not-found' };
}

// The row's parent episode, when the Parent Episode relation is filed
// and the parent row rides the same slice. The relation id and the
// slice's notionPageId share the Notion page-id address space.
export function parentEpisodeOf(post: ForumPost, posts: ForumPost[]): ForumPost | null {
  if (!post.parentEpisodeId) return null;
  return posts.find((p) => p.notionPageId === post.parentEpisodeId) ?? null;
}

// Public appearance is a NAME join (the accepted Phase 1 limitation):
// a row appears when a public item carries its suffix-stripped name.
// The detail page labels this as name-matched, never as the row's own
// release state (packet S A1).
export function appearsInRelease(post: ForumPost, items: { name: string }[]): boolean {
  const name = postName(post);
  if (!name) return false;
  return items.some((item) => item.name === name);
}
