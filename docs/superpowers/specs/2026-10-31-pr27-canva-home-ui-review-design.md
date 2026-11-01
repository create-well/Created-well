# PR #27 Canva home UI review-fix design

**Date:** 2026-10-31
**Status:** Design approved; awaiting review of this written spec before implementation.

## Context and problem

The independent review of PR #27 identified three UI-only findings in the Canva home view. The “Recent currents” card reads `wellNotes[0]`, although new notes are appended to context state; therefore the selected note is not reliably the newest. The arrival and mood choices expose selected state only through a CSS class, so assistive technology is not told which toggle is active.

The user has directed that source/cache/sync changes remain on hold until an authoritative binding is documented, and that PR #27 must not be merged meanwhile. This design does not change data authority, persistence, API responses, shared check-in history, or private check-in fields.

## Approaches considered

1. **Pure timestamp selector for the card (recommended).** Select the entry with the greatest valid `created_at`, break ties by the later array entry, ignore invalid timestamps if any valid timestamps exist, and fall back to the last entry only if all timestamps are invalid. Do not mutate or reorder the shared array. This is robust to both hydration order and newly appended notes without affecting other consumers.
2. **Reorder all Well Notes at the context boundary.** This would make every consumer inherit a new ordering contract and could affect other views; it is broader than the review finding.
3. **Use the last entry directly.** This matches current append behavior for new notes but assumes hydration order and timestamp consistency; it is less robust than option 1.

For accessibility, the selected-state contract is `aria-pressed={arrival === option}` for arrival buttons and `aria-pressed={mood === label}` for mood buttons. No other visual, interaction, or persistence behavior changes.

## Approved design

- Add a pure `latestWellNote` helper in `src/lib/homePanels.ts`; use it in `CanvaHomeView.tsx` for the Recent currents card. The helper must leave its input array unchanged and return `undefined` for an empty array.
- Add `aria-pressed` to the existing arrival and mood buttons in `CanvaHomeView.tsx`, derived from the same state used by their current `is-selected` classes.
- Keep this patch isolated from the pending source-binding decision: do not change dashboard fetches, sort shared state, modify any check-in behavior, change APIs, or edit sync/database code.

## Verification plan

Add pure unit coverage for timestamp ordering independent of array order, deterministic timestamp ties, invalid/missing timestamps, empty input, and immutability. Add a static source test that verifies the two JSX `aria-pressed` expressions are present. Run the focused tests and the full Node test suite. Report these as pure/static checks; they are not a rendered or authenticated runtime accessibility test. Do not push or merge this candidate.

## Scope

Planned files: `src/lib/homePanels.ts`, `src/app/components/CanvaHomeView.tsx`, `tests/home-panels.test.mjs`, and a focused `tests/canva-home-a11y.test.mjs`. No other file is in scope for this UI-only design. Repository: `create-well/Created-well`; branch: `feature/canva-dashboard-v2`; worktree: `/Users/monicablanco/.work/create-well/pr-27-auth-fix`; base under review: `origin/main` at `ad3b7240e90440d239e758642d2c7e8b19e2bb29`.
