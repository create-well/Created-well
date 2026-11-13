# Site ↔ Notion Mirror Map — dash.cr8w.com
**Refreshed:** 2026-11-13 · **Pinned to main:** 5396ceb39b66d780eb74d49c91ab26e5be7b1e42 · **Replaces:** site-notion-mirror-map-2026-10-27.md (see Recovery note)

## Recovery note (read first)
The 2026-10-27 map is **UNRECOVERED**: not in the git tree, git history, local disk, or Notion (title search, 2026-11-13, DIRECTLY CHECKED). Its pins (0b28eb35 / 032aec1) were never re-read firsthand; anything attributed to it is REPORTED. Its scaffold cross-check list X-1..X-6 is likewise UNRECOVERED — the fresh cross-check below (§5) supersedes it with firsthand findings.

## 1. Read path (one hop, every route)
All nine routes render from one payload: `DashboardContext` → `GET /api/dashboard` (`api/dashboard.ts`, Vercel) → one fan-out → normalizers (`src/lib/notionNormalizer.ts` et al.). This is the single hop; per-route slices below name the exact source behind each view.

| Route | View (file) | Slice → source (one hop) |
|---|---|---|
| `/` | ThisWeekPage + HomePanels | `tasks`→MOVES, `stations`/`peopleCare`→PEOPLE, `forum`→CONTENT, `coflowDates`→FLOWS, announcements→KV `cr8w_announcements` |
| `/moves` | MovesPage + **GeyserView** | `tasks`→MOVES (registry rows carry `registryMirror`), `stations`→PEOPLE, `forum` (presented as `forum.filter(f => !f.registryMirror)` — registry exclusion live here), `forumReplies`→KV, announcements→KV |
| `/care` | CarePage | `stations`→PEOPLE, `peopleCare` (computed), `openAsksCare`→OPEN_ASKS (optional source, `queryNotionDatabase`) |
| `/flows` | FlowsPage (tab strip; ARIA model `src/lib/tabList.ts`) | `coflowDates`→FLOWS + Partiful link projected through each flow's EVENTS relation (`buildFlowPartifulLinks`), `events`→EVENTS |
| `/podyaps` | PodyapsPage | `forum`→CONTENT (episodes) |
| `/workshops` | WorkshopsPage → CommunityEventsView | `coflowDates`→FLOWS filtered `isWorkshop` + book-club sub-filter; empty state names FLOWS as the source. (KV `cr8w_workshops`/`cr8w_workshop_programs`/`cr8w_workshop_resources` slices exist in the payload for program/resources surfaces.) |
| `/money` | MoneyPage | `money`→MONEY **⚠ DRIFT**: code reads `NOTION_DB_MONEY` at 5396ceb, but the Notion source is renamed **"RETIRED — MONEY (ledger snapshot, 2026-11-09)"** (DIRECTLY CHECKED 2026-11-13). The bookkeeping workbook is the money source of record per the owner; the code path is a NAMED GAP until rerouted. |
| `/decisions` | DecisionsPage | `decisions`→KV `cr8w_decisions` (boundary-validated; `src/lib/decisionsView.ts`) — **two-hop by design**: no Notion decisions source exists; KV is canonical. Justification: decisions are an app-native ledger, mirrored to Notion only via sync-engine projection if enabled. |
| `/system` | SystemPage | `syncFreshness`→Supabase `sync_delivery_state` (reader decision 2026-10-27); run history→`api/sync-runs.ts` |

**Sign-in gate (not a route):** `AuthGate` (`src/app/components/AuthGate.tsx`) + `src/lib/recoveryEntry.ts` + `api/_auth.ts`. The old name **LoginGate is deleted** (survives only in plans/imports/templates). Dashboard-password claim stays OPEN until a fresh live owner sign-in proves it — never mark closed from code inspection.

## 2. Source registry (live code, 5396ceb)
- `api/_notion-sources.ts` SOURCES (sync engine, 7): moves, people, flows, content, money, events, feedback — env-resolved (`NOTION_DB_*`), ids never hard-coded.
- `api/dashboard.ts` reads 8 Notion sources: the 7 above **+ `openAsks`** (`NOTION_DB_OPEN_ASKS`, optional, single-attempt). Wording fix (was: "the seven sources feed the dashboard"): the dashboard fan-out reads eight; the sync registry lists seven.
- KV slices (11, all boundary-validated by `api/_kv-validation.ts` at the read): `cr8w_messages`, `cr8w_braindumps`, `cr8w_announcements`, `cr8w_forum_replies`, `cr8w_workshops`, `cr8w_workshop_programs`, `cr8w_workshop_resources`, `cr8w_coflow_checkins`, `cr8w_well_notes`, `cr8w_calendar_events`, `cr8w_decisions`.
- Store: Supabase project irtqcygriedvdijppntz, table `kv_store_dabe1c74` (14 resource types, per record of note 2026-11-13). Prototype project twenzbbbxdffsyoiynwg never appears in code (DIRECTLY CHECKED).

## 3. Write-back paths (governed only)
Reads: `GET /api/dashboard` (cache-disabled), `api/public-content.ts` (CMS projection), `api/sync-runs.ts`, `api/snapshot.ts`.
Writes: client `api.ts` → same-origin `/api/server/*` (tasks/stations/forum/messages/braindumps/announcements/workshops/workshop-programs/…); Notion writes land through the governed writer (`api/_notionWriter.ts`) and `POST /api/server/money` for money. **No route writes to Notion outside these paths.**
**Named gap:** RSVP → FLOWS app-side write path is UNBUILT; named KV home `cr8w_workshop_rsvps` (not in KV_KEYS — consistent with unbuilt). Go/no-go is the owner's. Notion-side, `Create Well · Registrations & Check-ins` (9 props) and `Create Well · Guest candidates` (8 props) exist (DIRECTLY CHECKED 2026-11-13) as candidate targets — named, not wired.

## 4. Stale rows — corrected (verified firsthand at 5396ceb)
1. **Sign-in gate row:** LoginGate deleted → AuthGate changed; `src/lib/recoveryEntry.ts` added. ✔
2. **Workshops row:** WorkshopsView deleted → route lives under `src/app/pages/WorkshopsPage.tsx`. ✔
3. **Registry note:** `registryMirror` flag + presentation exclusion live in code (`RootLayout.tsx`, `api.ts`, `MovesPage.tsx`, `notionNormalizer.ts`; pinned by `tests/registry-mirror-flag.test.mjs`, `tests/mirror-exclusion-leg2.test.mjs`). ✔
4. **Geyser:** `src/app/components/GeyserView.tsx` — changed, previously unmapped → **now mapped** under `/moves` (§1). ✔
5. **New modules:** `api/_kv-validation.ts`, `api/_sync-alerts.ts`, `src/lib/canonicalFallback.ts`, `src/lib/decisionsView.ts`, `src/lib/recoveryEntry.ts` — all present at 5396ceb. ✔
6. **MONEY row:** see §1 drift — Notion source retired/renamed 2026-11-09; code path unchanged. Owner decision required.

## 5. Scaffold cross-check 2026-11-13 (supersedes unrecovered X-1..X-6)
- **W-1:** "seven sources feed the dashboard" → dashboard reads eight (OPEN_ASKS). Fix the count wherever the map family says seven.
- **W-2:** The old map's Geyser row said "unmapped" — it is mapped; keep the §1 row.
- **W-3:** Money wording must carry the retirement rename + workbook-as-source-of-record; do not describe `/money` as reading a live Notion money DB.
- **W-4:** `cr8w_workshop_rsvps` is a reserved, unbuilt key — name it a gap, never a live slice.
- **W-5:** Decisions is KV-canonical (two-hop, justified in §1) — do not force a one-hop Notion mapping that does not exist.
- **W-6:** The 6-item nav and `/flows` tab strip are presentation, not sources; the tab keyboard model is `src/lib/tabList.ts` (name it, don't imply a CMS source).

*Original X-1..X-6 wording fixes: UNRECOVERED (list lost with the 2026-10-27 file). If the owner holds a copy, diff §4–§5 against it and merge.*
