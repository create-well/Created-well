# QA Scoring Packet — PR #92 (seed scripts: passwords env-only, username-map KV table live)
**Scored:** 2026-11-13 · **PR head:** ac06e1c54d61e5976c90e5505ea08317d465fc3c · **Base:** main 5396ceb3 (pre-T4)

## Gates
| Gate | Verdict | Evidence |
|---|---|---|
| Fresh base | PASS | `gh pr view 92` OPEN/MERGEABLE 2026-11-13; merge with main clean, no conflicts (DIRECTLY CHECKED). |
| Scope diff | PASS | 4 files, +59/−5: `scripts/seed-auth-user.mjs`, `scripts/seed-mb-admin.mjs`, `scripts/seed-username-map.mjs`, `tests/seed-scripts-hygiene.test.mjs` (new). |
| Literal scan | PASS (improves hygiene) | REMOVES hardcoded password literals from seed scripts (values visible only as removed `-` lines in the diff — the point of the PR). Passwords become env-only `CR8W_PASSWORD` with missing-env refusal. Fixes dead KV table name → live `kv_store_dabe1c74`. New hygiene test pins: no password literal assignment, no `?? 'literal'` fallback, no printed passwords in headers. No new secrets, no GitHits files, no env values. |
| Suite (failure count) | PASS | Merged-head battery: 206/206 across both TZs (Node 24.22.3), 0 failed. |
| Type check | CONDITIONAL | Same inherited TS2688 as PR #91 — fixed on main by 263a28c after this battery; re-run post-rebase expected green. |
| Build | PASS | merged-head build green. |
| Merge-tree equality | PASS | Clean merge; delta vs main == PR delta (4 files). |
| READY-at-SHA / route matrix | NOT RUN | Landing not executed — owner decision (below). |

## Landing recommendation
**OWNER DECISION REQUIRED.** Credential-handling change (auth-adjacent under hard gates), even though it strictly reduces repo secret exposure and is the kind of cleanup the security posture wants. Note: the hygiene test encodes the current literals' absence — landing soon keeps that pin from rotting. Suggested next action: Monny says YES/NOT NOW in dev chat; on YES, land after rebasing onto current main (post-263a28c) and re-running the battery.
