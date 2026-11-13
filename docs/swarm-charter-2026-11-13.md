# CR8W Dev Team Swarm Charter — Full CMS-Connected Dashboard Deploy
**Date:** 2026-11-13 · **Coordinator:** muse (front door) · **Swarm:** UX, UI/Design, Frontend, API, QA lanes

## 1. Premises verified live (Phase 1, coordinator firsthand)

| Premise | Status | Evidence |
|---|---|---|
| Repo `create-well/Created-well`, main head | **CONFIRMED — 5396ceb3** | `git fetch` + `git rev-parse origin/main` 2026-11-13 |
| 9 live routes `/, /moves, /care, /flows, /podyaps, /workshops, /money, /decisions, /system` | **CONFIRMED** | `src/app/routes.ts` at 5396ceb3 (code-split lazy pages) |
| Vercel project `createdwell`, canonical host dash.cr8w.com | **CONFIRMED** | `vercel project ls`: createdwell → https://dash.cr8w.com, prod Ready; `cr8w-holding` separate, untouched |
| Production deploy at main head | **REPORTED (timestamp correlation)** | latest prod deploy created 2026-11-09 06:11:47 PST, ~70s after 5396ceb3 commit time; QA confirms READY-at-SHA at next landing |
| Design tokens: 30 tokens, NINE type styles (display, display-m, h2, h3, cardtitle, eyebrow, label, body, small) | **CONFIRMED** | `src/styles/tokens.json` at 5396ceb3 parsed firsthand; the Nov 9 "ten styles / card_title / display-m missing" claim stays FALSE and closed |
| PR #102 (Leg B) head d1d56341, PR #103 (Leg D) head 2921d918, both OPEN + MERGEABLE + HELD | **CONFIRMED** | `gh pr view` 2026-11-13 |
| PR #91 (b663d311) and #92 (ac06e1c5) OPEN + MERGEABLE | **CONFIRMED** | `gh pr view` 2026-11-13 |
| SQL v3 dependency: `claim_state` used by PR102/103 code, absent from main schema | **CONFIRMED** | `claim_state` absent from main (1 incidental mention in `api/_sync-alerts.ts`); 14 hits at PR102 head; `docs/live-sync-lease-supabase.sql` is the sitting pattern of record |
| Sync files shared by B and D (conflict pair) | **CONFIRMED** | both PRs touch `api/_supabase.ts, _sync-alerts.ts, _sync-engine.ts, _sync-ledger.ts, notion-webhook.ts, reconcile.ts` |
| Supabase ref irtqcygriedvdijppntz only; prototype twenzbbbxdffsyoiynwg absent from code | **CONFIRMED** | `git grep` across api/src/utils/supabase: 8 hits, all irtqc…; zero for twenz… |
| New modules named in brief exist on main | **CONFIRMED** | `api/_kv-validation.ts`, `api/_sync-alerts.ts`, `src/lib/canonicalFallback.ts`, `src/lib/decisionsView.ts`, `src/lib/recoveryEntry.ts` all in tree at 5396ceb3 |
| LoginGate/WorkshopsView deleted; `registryMirror` flag live | **CONFIRMED** | names survive only in plans/imports/templates; `registryMirror` in RootLayout, api.ts, MovesPage, notionNormalizer + both mirror tests |
| Gate suite definition | **CONFIRMED** | `.github/workflows/ci.yml`: per-file `node --experimental-strip-types --test tests/*.test.mjs` under TZ=America/Los_Angeles **and** UTC, both lease drivers, `npx tsc --noEmit`, `npm run build` |

## 2. Drift log (named, with owner)

- **D-1 (repo identity):** the `local-cr8w-dashboard` skill's repo facts are stale — old cr8w-dashboard project is RETIRED (repo AGENTS.md states this firsthand). Live product = `create-well/Created-well`, Vercel `createdwell`. All lanes work in Created-well.
- **D-2 (mirror map file absent):** `site-notion-mirror-map-2026-10-27.md` is not in the git tree, git history, or local disk. T1 checks Notion for the canonical copy; if none, authors the refreshed map from the live route registry and records that the 2026-10-27 file itself is UNRECOVERED (pins 0b28eb35 / 032aec1 never re-read firsthand).
- **D-3 (repo AGENTS.md partially stale):** it references `api/workspaceSync.ts` and a daily 09:00 cron; live tree has `api/server/` and a `*/15` `/api/reconcile` cron (vercel.json at 5396ceb3). Treated as reference only; never staged/committed/pushed (untracked GitHits file).
- **D-4 (new refs since briefing):** branches `preview/flow-nav-followup-sweep`, `qa/playwright-probe-pack`, tag `v1.4.2` appeared on origin at fetch time. Not in mission scope; QA notes their existence, no action.
- **D-5 (Notion sources):** not yet re-verified firsthand this session → T5 (read-only). MONEY-retired / workbook-is-source-of-record stays REPORTED until T5 or the owner re-confirms.

## 3. Hard gates (no lane crosses)

1. No secret values in any prompt, file, brief, log, or message. Env var names only, never values.
2. Sign-in, MFA, approval taps: owner's hands only. The dashboard-password claim stays OPEN until a fresh live owner sign-in proves it — never claim it closed.
3. No production DDL outside the named SQL v3 gated sitting (owner executes; T7 prepares the packet only).
4. No payments, public publishing, permanent deletion, permission escalation, DNS/domain changes.
5. Routine reversible internal merges may proceed on QA PASS under the mission's standing authorization. Anything auth/RLS, public-exposure, destructive, or irreversible escalates to the owner first → **PR #92 (passwords env-only, username-map KV) and PR #91 (sign-in gate recovery latch) are staged with packets only; landing is the owner's call.**
6. GitHits files in the working tree (`AGENTS.md`, `.cursor/`, `.qoder/`, `.junie/`, `.kiro/`, `.qwen/`, `.agents/`) are deliberate and untracked: never stage, commit, or push them.
7. QA never executes, merges, or deploys. One executor per landing pass. RSVP → FLOPS write path stays unbuilt; go/no-go is the owner's (named KV home `cr8w_workshop_rsvps`).

## 4. Flows of record (every lane)

- **Deploy pipeline:** pinned-head true merges only · production READY verified at the exact merge SHA on dash.cr8w.com · per-surface check matrices · merged-branch cleanup only at a verified landed SHA.
- **Verification packet standard:** fresh base · scope diff · literal scan · type check · full suite with **failure COUNT as the gate** · merge-tree equality · READY-at-SHA on canonical host · live route matrix.
- **Bug lifecycle:** rank A/B/C, clock on live bugs, unblock-first.
- **Mirror-keeper:** every route one hop to its Notion source; any two-hop mapping named + justified.
- **Notion verify-before-write:** enumerate what exists → compare name AND configuration → skip on exact match → flag on collision → create only when nothing matches. New databases / top-level pages need a named home + owner approval. **This swarm is read-only on Notion; no lane writes.**
- **Battery discipline:** gate every push on the suite failure count; any cross-module signature change also runs `npx tsc --noEmit`; a red gate stops the landing, not the queue.
- **Evidence discipline:** every claim labeled DIRECTLY CHECKED / REPORTED / NOT VERIFIED. Relayed values never override firsthand reads. Receipts reconcile git remote + provider record + production probes; disagreements recorded with an owner, never averaged.
- **Reporting shape:** headline, gist bullets, link, one next action. Depth lives in project docs.

## 5. Task graph

| # | Task | Lane | Input | Exit test | Handoff | Gate | Failure path |
|---|---|---|---|---|---|---|---|
| T1 | Mirror-map refresh | FRONTEND (+API consult) | Live route registry at 5396ceb3; brief's verified stale list; mirror-keeper standard | Every route one hop to source; stale rows fixed (sign-in gate: LoginGate deleted/AuthGate changed/recoveryEntry.ts added · Workshops: WorkshopsView deleted, route under WorkshopsPage · registry: registryMirror flag + presentation exclusion live · Geyser: changed, mapped or named-unmapped); X-1..X-6 wording fixes; pins read 5396ceb3 | QA (T8) → coordinator landing (T9) | QA literal scan + one-hop validation; suite green | Notion canonical copy found → diff vs live tree, keep Notion as source; a route with no one-hop source → named two-hop + justification; file unrecoverable → say so, author from registry |
| T2 | Flow-to-view derivations | UX | 9 live routes; Notion source map (T5 read-only findings) | Per-view spec: CMS source, exact query, honest states incl. partial/empty, write-back path or named gap; RSVP → FLOPS named gap w/ KV home `cr8w_workshop_rsvps` | Frontend lane as build input; docs/ux/ | Spec review only (docs) | Source unverifiable → spec marks that view's source NOT VERIFIED, still ships with honest states |
| T3 | Token pipeline + registry | UI/DESIGN | `src/styles/tokens.json` (30 tokens, nine styles), `guidelines/tokens.md`, `templates/registry.json`, generator/parser scripts | Deterministic parser round-trip at ZERO diffs; registry diff report; any fix regenerates from the record only — no model-invented values, no generated imagery | QA (T8) → landing (T9) | Round-trip diff = 0; suite green | Any nonzero diff → fix the OUTPUT from the record, never hand-edit values to match |
| T4 | Non-gated sync/write-back fixes + coverage | API | `api/` sync engine at 5396ceb3; suite failure count on current main; T5 findings | Fix branch scoped to non-gated surfaces only; new/updated tests for every changed surface; full battery green with failure count 0 | QA (T8) → landing (T9) | Suite + typecheck + build, both TZs | Any fix that touches auth/RLS/DDL → pull it from the branch, name it, escalate to owner |
| T5 | Notion source-map verification (READ-ONLY) | API | Notion "create well CMS" connection (Read verified live) | Per-source report: PEOPLE, FLOWS, MOVES, CONTENT, EVENTS, FEEDBACK (live sync), INVENTORY (sync program open), WELL INBOX (8-field captures ledger + Intake beside it), MONEY retired — each labeled DIRECTLY CHECKED / REPORTED / NOT VERIFIED; collisions/drift flagged | T1, T2, T4 inputs | Read-only; zero writes | A source unreadable or shape drifted → labeled NOT VERIFIED with the exact failing check, no retry storm |
| T6 | QA scoring packets: PR #91, #92 | QA | PR heads b663d311 / ac06e1c5 vs main 5396ceb3 | Evidence packet per PR: fresh base, scope diff, literal scan, type check, suite failure count, merge-tree equality — verdict only, no landing | Owner decision (auth-adjacent both) | QA PASS/FAIL each | Packet red → recommendation DO NOT LAND with the failing gate named |
| T7 | Stage gated Legs B + D (single executor) | API (+QA consult) | PR #102 head d1d56341, PR #103 head 2921d918, current main | B rebased onto current main; D rebased onto B (stacked — shared sync files); full battery per leg, both TZs; sitting-ready SQL v3 packet: pre-state re-read (information_schema columns on `sync_delivery_state`), exact `ALTER TABLE … ADD claim_state … / ADD mirror_populated_at …` statements, blast radius, rollback, post-DDL verification legs; QA scoring packet per leg | Owner's one-tap sitting | **STOP at the SQL v3 gate — no DDL, no merge** | Rebase conflict unresolvable without behavior change → stop, name the conflict hunk, hold the leg at its last green SHA |
| T8 | Score + verify landings | QA | Phase 2 landing candidates at pinned heads | Packet per candidate; post-merge READY-at-SHA on dash.cr8w.com; live route matrix (9 routes); receipts reconciled across git remote, Vercel record, production probes | Coordinator | QA PASS required to land | Red gate → candidate held, queue continues |
| T9 | Land approved legs | COORDINATOR (only executor) | T8 PASS packets | Each merge at pinned head; deploy READY at exact merge SHA; merged branch cleaned up only at verified landed SHA; receipt filed per landing | Final synthesis | One merge at a time | Any mismatch between git remote / Vercel / probes → recorded with owner, receipt left open |
| T10 | Final synthesis | COORDINATOR | All receipts + held-gate list | Landed / held-at-gate / NOT VERIFIED, each with owner + one next action | Owner | — | — |

## 6. Branches and receipts

- Phase 2 lanes branch as `docs/mirror-map-refresh-2026-11-13`, `docs/ux-view-derivations-2026-11-13`, `chore/token-pipeline-verify-2026-11-13`, `fix/api-non-gated-sync-2026-11-13` (API lane names the final branch to match content), charter on `docs/swarm-charter-2026-11-13`.
- All lanes work in their own git worktree off **current origin/main at execution time**; never in the owner's `~/Created-well` checkout; never push to main directly; never stage the untracked GitHits files.
- Receipts reconcile: git remote SHA · Vercel deployment record (READY + SHA) · production probes (route matrix). A disagreement is recorded with an owner, never averaged away.

## 7. Execution-mode addendum (2026-11-13, in-session)

- **A-1:** Swarm dispatch FAILED its live check: AgentSwarm launched 7 lane agents; all failed at spawn with `x-api-key header is required` (subagent runtime missing its provider key in this session). Resume retry failed identically; a direct Agent probe failed identically. The standard parallel path is unavailable and not fixable from inside the session.
- **A-2:** Non-blocked legs continue under the mission's own rule: the coordinator executes the lane tasks inline, sequentially, one worktree, same gates, same evidence discipline. One executor per landing pass is trivially satisfied. Lane receipts below record this mode.
- **A-3:** To re-run as a true parallel swarm: configure the subagent provider API key for Kimi Code, then `/reload` and re-dispatch from this charter. All lane briefs are reproducible from the task graph.
