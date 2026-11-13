# Flow-to-View Derivations — dash.cr8w.com
**Date:** 2026-11-13 · **Pinned to main:** 5396ceb3 · **Lane:** UX · **Companion:** docs/site-notion-mirror-map-2026-11-13.md

Every view below renders from the single `GET /api/dashboard` payload via `DashboardContext` (primary sync source; the legacy `api.sync()` KV path is the fallback when `/api/dashboard` is unreachable). Honest states come from `ViewShell` (`loading` / `failed` with retry / `stale` / `fresh` + empty titles) and per-slice `sourceErrors` (a failing source degrades only its own slice to empty and is named on the payload — F-FANOUT).

## `/` — This Week (home)
- **Source slices:** tasks→MOVES, stations+peopleCare→PEOPLE, forum→CONTENT, coflowDates→FLOWS, announcements→KV `cr8w_announcements`.
- **Query:** one `GET /api/dashboard`; home panels computed by `src/lib/homePanels.ts`.
- **States:** loading skeleton (RouteSkeleton); empty board = healthy ("A clear board is a healthy board."); per-slice failures surface in Data Health / sourceErrors without failing the page.
- **Write-back:** none on this view.

## `/moves` — Next Moves (Geyser)
- **Source slices:** tasks→MOVES (with `registryMirror` rows), stations→PEOPLE, forum (excludes registry rows in presentation), forumReplies→KV, announcements→KV, wellNotes.
- **Query:** same payload; Geyser tabs (overview/journey/stations/tasks/forum — ARIA model `src/lib/tabList.ts`).
- **States:** empty = "No active moves"; failed = retry via `actions.retrySync`.
- **Write-back:** `actions.updateTaskStatus/updateTask/deleteTask` → `/api/server/tasks*` → governed writer (approved paths only).

## `/care` — Care
- **Source slices:** stations→PEOPLE; `peopleCare` computed from PEOPLE pages; `openAsksCare`→OPEN_ASKS (optional source; single-attempt read, so its slice is the first to degrade).
- **States:** empty states per panel; consent flags come from PEOPLE `Consent`/`Care Cleared?` fields.
- **Write-back:** none beyond person fields through governed routes.

## `/flows` — Flows (tab strip)
- **Source slices:** coflowDates→FLOWS; `events`→EVENTS; Partiful RSVP link projected per flow through its EVENTS relation (`buildFlowPartifulLinks`, register 1484 Leg 1).
- **States:** empty = "Nothing flowing yet… Add a FLOW in Notion"; tab strip follows the ARIA tabs pattern (arrow keys move+activate).
- **Write-back:** **NAMED GAP — RSVP → FLOWS is unbuilt.** Named KV home `cr8w_workshop_rsvps`. Notion-side targets exist (`Create Well · Registrations & Check-ins`, `Create Well · Guest candidates` — DIRECTLY CHECKED 2026-11-13) but no wire path. **Go/no-go: owner.**

## `/podyaps` — Podyaps
- **Source slice:** forum→CONTENT, episodes filter.
- **States:** empty = no episodes published.
- **Write-back:** content-final path is governed (single safe CONTENT row protocol; this swarm performed no writes).

## `/workshops` — Workshops & Gatherings
- **Source slices:** coflowDates→FLOWS filtered `isWorkshop` (+ book-club sub-filter); KV workshop slices (`cr8w_workshops`, `cr8w_workshop_programs`, `cr8w_workshop_resources`) feed program/resources surfaces.
- **States:** empty names FLOWS as the source ("Add a FLOW in Notion"); sub-tabs Wellshops/Book Club with counts.
- **Write-back:** workshop CRUD via `/api/server/workshops*`; **RSVP gap same as /flows.**

## `/money` — Money
- **Source slice:** money→`NOTION_DB_MONEY` at 5396ceb.
- **DRIFT (DIRECTLY CHECKED 2026-11-13):** the Notion database is renamed **"RETIRED — MONEY (ledger snapshot, 2026-11-09)"**; the bookkeeping workbook is the money source of record. Production `/money` therefore reads a retired snapshot until the route is rerouted — **named gap, owner decision.** "Next right money move" is KV-persisted (`money_next_move`), not a Notion write.
- **States:** "No money tracked yet. Real numbers only."

## `/decisions` — Decisions
- **Source slice:** decisions→KV `cr8w_decisions` (boundary-validated), view logic `src/lib/decisionsView.ts` (urgency sort, pending/decided, build/create/decide/defer).
- **States:** empty = no pending decisions; urgency ordering pinned.
- **Write-back:** KV via governed server routes; two-hop to Notion only via sync projection — justified in the mirror map §1.

## `/system` — System
- **Source slices:** `syncFreshness`→Supabase `sync_delivery_state` (fail-soft per source; a store problem reads "unknown" and never fails the payload); run history→`api/sync-runs.ts`.
- **States:** readiness checks render per source; **the dashboard-password claim stays OPEN** — provable only by a fresh live owner sign-in, never by code inspection.

## Sign-in gate (all routes)
`AuthGate` + `src/lib/recoveryEntry.ts` + `api/_auth.ts`. Session restore passes on the current build (4 reloads, brief "Checking your session…" flash — known history, not a bug). Dev bypass exists via `VITE_DEV_BYPASS` (local only). No agent may sign in as the owner; approval taps are hers.
