# QA Scoring Packet — PR #91 (R-0 structural recovery latch)
**Scored:** 2026-11-13 · **PR head:** b663d3111744c6a8f9215c239c0a3d8b3812c83d · **Base:** main 5396ceb3 (pre-T4)

## Gates
| Gate | Verdict | Evidence |
|---|---|---|
| Fresh base | PASS | `gh pr view 91` OPEN/MERGEABLE 2026-11-13; merge-base 886044e-era branch, merge with main clean, no conflicts (DIRECTLY CHECKED in worktree) |
| Scope diff | PASS | 5 files, +191/−6: `src/app/App.tsx`, `src/app/components/AuthGate.tsx`, `src/app/components/TopNav.tsx`, `src/lib/recoveryEntry.ts` (new), `tests/r0-recovery-latch.test.mjs` (new). Exactly the brief's "sign-in gate row (AuthGate changed, recoveryEntry.ts added)". |
| Literal scan | PASS | No secret literals, no env values, no GitHits files. Password-recovery latch logic only; comments reference PASSWORD_RECOVERY event without values. |
| Suite (failure count) | PASS | Merged-head battery: 206/206 across both TZs (Node 24.22.3), 0 failed. |
| Type check | CONDITIONAL | Inherits main's pre-existing TS2688 (absent @types/node) — fixed on main by 263a28c (T4) after this battery ran; re-run post-rebase expected green. |
| Build | PASS | merged-head `npm run build` green (part of battery script). |
| Merge-tree equality | PASS | `git merge origin/main` clean; resulting tree 610ecf9 (contains PR delta + main); PR's own delta vs merge-base identical to delta vs main. |
| READY-at-SHA / route matrix | NOT RUN | Landing not executed — owner decision (below). |

## Landing recommendation
**OWNER DECISION REQUIRED.** This PR changes sign-in gate behavior (structural recovery latch for the password-recovery race + always-visible top-bar sign out) — auth-adjacent under the hard gates. Gates are green; the call is the owner's. Suggested next action: Monny reviews the latch UX in a preview deploy, then says YES/NOT NOW in dev chat.
