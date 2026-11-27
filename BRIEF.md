# BRIEF: BUILDER leg 1, public-payload card component

Kimi Code dev team, BUILDER role. muse is LEAD and verifies your output firsthand; your work stops at READY FOR QA. Standing prompt for dashboard work: read ~/workspace/createwell/dashboard-dev-prompt-v3-2026-11-19.md first; its gates apply. This leg touches no attendance, check-in, or write path, so its write-path clauses do not expand this scope.

Base: production main 9bb6b6450288b4a4632421c238f061b9256b9432. Work only in this worktree, on branch feat/public-payload-card. Repo of record is this worktree only; the retired cr8w-dashboard clone is excluded.

## Outcome

The /api/public-content projection (the CMS connector's public output) has data legs (api/public-content.ts, src/lib/publicContent.ts, src/lib/usePublicContent.ts) and no rendering component consuming them. Build the first one: a public-payload card component for the registry's gatherings-card template (templates/registry.json, id gatherings-card), following the File B Figma pattern (Gatherings Card set: Published / Waitlist / Cancelled variants; Cancelled carries a darkrust banner and drops the spots and RSVP rows).

## The projection shape, read firsthand at the base (do not invent beyond it)

PublicContentItem (src/lib/publicContent.ts) carries exactly six fields:
- name: string (the title)
- link: string | null (the card's outbound link; the client type says string | null, the server projection emits a string that may be empty)
- contentType: string | null
- publishDate: string | null (a date or datetime string; no separate time field exists)
- where: string | null (the location)
- tag: string | null

The route's gate guarantees every item in the projection passed Status = Published, Final? checked, Audience = Public. The projection carries NO status field, NO time field, NO spots or capacity field, and NO cover image. The component renders only what the item carries:
- Title from name.
- Date from publishDate through the existing itemDateLabel helper in src/lib/publicContent.ts (never a raw string, never Invalid Date). No time is rendered, because no time field exists.
- Location from where, only when present.
- Tag and contentType as the card's chips, only when present.
- The link as the card's call to action, only when non-empty.

## Status variants (display variants, not data)

Status is a presentational variant prop, not a projection field:
- type PublicCardStatus = 'published' | 'waitlist' | 'cancelled', prop `status`, default 'published' (the only state the gate guarantees).
- published: the plain card.
- waitlist: the card plus a visible Waitlist chip.
- cancelled: a banner across the top of the card reading Cancelled, background var(--darkrust), text var(--cream); the link call to action is NOT rendered (the File B rule: cancelled drops the RSVP row; there is no spots row to drop because the projection carries no spots).

## Files to create

1. src/lib/publicContentCard.ts: the pure model layer, following the repo's lib conventions (like src/lib/homePanels.ts: pure functions the node test suite can import).
   - export type PublicCardStatus (above).
   - export interface PublicCardModel with the render-ready fields: title, dateLabel, where (string | null), tag (string | null), contentType (string | null), link (string | null, already normalized: empty string becomes null), status, bannerText (string | null, 'Cancelled' only for cancelled), chipText (string | null, 'Waitlist' only for waitlist), showLink (boolean: link present AND status is not cancelled).
   - export function publicCardModel(item: PublicContentItem, status: PublicCardStatus = 'published'): PublicCardModel. Use itemDateLabel for dateLabel. Title falls back to '' only if name is empty; do not invent a placeholder title.
2. src/app/components/PublicContentCard.tsx: the component, following the repo's component conventions (named function export, inline styles as in ReleaseStateBlock.tsx and FlowCard, no new dependencies).
   - Props: { item: PublicContentItem; status?: PublicCardStatus; className?: string }.
   - Renders through publicCardModel. Structure: optional cancelled banner on top; title as the card heading; a meta line with the date label and, when present, the location; chips row for contentType and tag when present; the Waitlist chip when the model carries one; the link row (an anchor with the item link, label 'RSVP' when status is waitlist or published and a link exists; use the link itself as href, target _blank, rel noopener noreferrer) only when showLink.
   - Styling: design tokens of record ONLY, the generated Layer 1 names in src/styles/tokens.css: colors var(--rust), var(--darkrust), var(--clay), var(--peach), var(--camel), var(--sand), var(--cream); radius var(--r-card); spacing var(--space-xs), var(--space-s), var(--space-m); typography through the --type-* variables (family, size, weight, leading, tracking for cardtitle, eyebrow, label, body, small as appropriate). NEVER use the refresh fork names: --deep-rust, --clay-velour, --peach-haze, --camel-sun, --sandstone are forbidden in the new files. Text color: use var(--darkrust) for headings and color-mix or the token palette for secondary text; if a needed neutral is not in Layer 1, use currentColor or inherit rather than a fork variable.
3. tests/public-content-card.test.mjs: node:test, assert/strict, the repo's test conventions (see tests/public-content.test.mjs and tests/board-card-title.test.mjs).
   - Model tests: full item maps every field; null and empty fields normalize (empty link becomes null, showLink false); missing publishDate yields itemDateLabel's 'Date not set yet.'; waitlist yields chipText 'Waitlist' and keeps showLink true when a link exists; cancelled yields bannerText 'Cancelled' and showLink false even when a link exists; default status is 'published' with bannerText and chipText null.
   - Source tests on the component file: it imports publicCardModel; it references the item link as the anchor href; it contains var(--darkrust) for the banner; it does NOT contain any forbidden fork variable name (--deep-rust, --clay-velour, --peach-haze, --camel-sun, --sandstone); it does NOT contain the strings 'spots' or 'Spots' (no invented capacity row).

## Out of scope (do not touch)

- No mounting on any page or route; no edits to HomePanels.tsx, routes, or App.
- No RSVP write path, no Notion or KV writes, no api/ changes, no registry edits.
- No edits to src/lib/publicContent.ts or any existing file. New files only: the three above. BRIEF.md is the only other file you may leave modified, and only to append your evidence note at the end if you wish.
- No dependencies added. No git commit, push, or PR: LEAD lands the branch. Stop after the files are written and the checks below are run.

## Checks to run before you stop (report exact results)

- TZ=America/Los_Angeles node --experimental-strip-types --test tests/public-content-card.test.mjs
- TZ=UTC node --experimental-strip-types --test tests/public-content-card.test.mjs
- npx tsc --noEmit
- npm run build

## Stop condition

READY FOR QA: the three files written, the checks above run with results reported in your final message (pass and fail counts per command, verbatim failure lines if any), and nothing outside the scope touched. Budget for this leg: this single comprehensive pass is the plan; do not loop.

---

## BUILDER evidence note (2026-11-26)

State: READY FOR QA. Branch feat/public-payload-card, base 9bb6b64 (worktree HEAD, verified via git log at leg start). New files only: src/lib/publicContentCard.ts, src/app/components/PublicContentCard.tsx, tests/public-content-card.test.mjs. No existing file modified; nothing committed or pushed.

Checks run in this worktree (node v24.22.1, deps installed via npm ci from package-lock.json):
- TZ=America/Los_Angeles node --experimental-strip-types --test tests/public-content-card.test.mjs — tests 11, pass 11, fail 0.
- TZ=UTC node --experimental-strip-types --test tests/public-content-card.test.mjs — tests 11, pass 11, fail 0.
- npx tsc --noEmit — exit 0, no diagnostics.
- npm run build — exit 0, built in 7.29s (pre-existing >500 kB chunk warning only).

These are builder self-checks, not independent acceptance. Independent review is LEAD/QA's.
