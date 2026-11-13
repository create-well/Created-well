# QA Scoring Packets — Live-sync Legs B and D (staged, HELD at the SQL v3 gate)
**Staged:** 2026-11-13 · **Staging branches:** `fix/live-sync-leg-b-staged` (b7785c3, rebased from PR #102 d1d56341) · `fix/live-sync-leg-d-staged` (62cd72b, rebased from PR #103 2921d918, stacked on B) · **Base:** main 5396ceb3

## Leg B packet
| Gate | Verdict | Evidence |
|---|---|---|
| Fresh base | PASS | Rebased onto 5396ceb3 cleanly (single commit b7785c3). PR #102 head verified d1d56341 before staging. |
| Scope diff | PASS | Same 10 files as PR #102: api/_supabase.ts, _sync-alerts.ts, _sync-engine.ts, _sync-ledger.ts, notion-webhook.ts, reconcile.ts + live-sync-leg-[a,b,c,e,f] tests + rr001 fencing + lease ledger driver. |
| Literal scan | PASS | claim_state adoption + renewal dropped; no secrets, no GitHits files, no DDL in the diff. |
| Suite (failure count) | PASS | 206/206 both TZs (Node 24.22.3), 0 failed. |
| Type check | CONDITIONAL | Inherits pre-existing TS2688 — fixed on main by 263a28c; rebase post-fix expected green. |
| Build | PASS | |
| Merge-tree equality | PASS | Stacked: D = B + one commit (62cd72b); diff B..D touches only _supabase.ts(+5), _sync-engine.ts(+69), leg-d tests(+194), sync-freshness tests(+94). |
| READY-at-SHA / route matrix | NOT RUN | **HELD — SQL v3 gate.** Do not merge before the sitting. |

## Leg D packet
| Gate | Verdict | Evidence |
|---|---|---|
| Fresh base | PASS | Stacked on staged B (62cd72b). |
| Scope diff | PASS | B..D delta above; event-relative freshness ladder + mirror flag write (rev3 item 5, rev3.1 items 1, 5a). |
| Literal scan | PASS | No secrets / GitHits / DDL. |
| Suite (failure count) | PASS | 208/208 both TZs (adds tests/live-sync-leg-d.test.mjs), 0 failed. |
| Type check | CONDITIONAL | Same inherited TS2688 note. |
| Build | PASS | |
| READY-at-SHA / route matrix | NOT RUN | **HELD — SQL v3 gate.** |

## The gate (restated for the owner)
Both legs are code-complete and suite-green at their staged heads. The single blocker is the production DDL: `sync_delivery_state` needs `claim_state` (text, not null, default 'idle') and `mirror_populated_at` (timestamptz, nullable). The sitting-ready packet is `docs/live-sync-claim-state-supabase.sql` (same branch family): pre-state re-reads, exact statements in one transaction, grants/RLS delta none, blast radius, rollback, post-DDL verification legs, merge order B then D. **Owner executes the SQL in the Supabase editor; no agent does.** After the DDL: rebase both staged legs onto then-current main (picking up 263a28c), re-run batteries, merge B, verify READY-at-SHA, merge D, verify.
