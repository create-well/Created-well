# Notion Source Verification — Create Well OS (monnymade)
**Date:** 2026-11-13 · **Method:** `ntn` CLI (bot i@monnyfest.co) — search/query only. **Zero writes.** Read-only lane receipt.

Legend: **DIRECTLY CHECKED** = read firsthand via the API today · **REPORTED** = record states it, not re-read · **NOT VERIFIED** = could not be read.

| Source | Status | Finding |
|---|---|---|
| PEOPLE (hub) | DIRECTLY CHECKED | DB `e6be7838`, title "PEOPLE", 27 props incl. Bench Stage, Care Cleared?, Consent, Content Created, Flows Attended, Links — matches dashboard person shape. (Two smaller "People"/"PEOPLE" DBs also exist; hub = 27-prop one.) |
| FLOWS (hub) | DIRECTLY CHECKED | DS `bd5c4aa8`, title "FLOWS", 36 props incl. Stage, Status, Public URL, Registration Form, Craft Lead, Flow Keeper, Date, Inventory/Moves/Content/FEEDBACK relations — matches. Live rows verified (SLO Create: Mosaic Mirrors). |
| MOVES (hub) | DIRECTLY CHECKED | DB `b8ccf6c0`, title "MOVES", 14 props: Blocked By, Due, Flow, Name, Needs Tending?, Open?, Owner, Person, Status, Touchpoint, Type — matches. |
| CONTENT (hub) | DIRECTLY CHECKED | DB `cbb0082d`, title "CONTENT", 19 props incl. Audience, Clip Status, Content Type, Final?, Flow, Link, Name, Parent Episode, Publish Date — matches normalizeContent. (Title search surfaces marketing DBs first; hub DB confirmed on deep page.) |
| EVENTS | DIRECTLY CHECKED | DS `2eb8bf7f`, title "Events", 10 props incl. Date, Event, Flow, GCal ID, Partiful link, Status, Visibility — matches the Partiful projection. |
| FEEDBACK | DIRECTLY CHECKED | DB `e9d72666`, title "FEEDBACK", 8 props: Body, Date, Flow, Name, Person, Source, Status, Type — matches. |
| INVENTORY | DIRECTLY CHECKED | DS `cacf2c56`, title "INVENTORY", 17 props — matches; seeded rows live (Mosaic mirror craft materials, Convo cards set). Sync program open (not yet a dashboard read source — consistent with code: INVENTORY absent from `api/_notion-sources.ts`). |
| WELL INBOX | DIRECTLY CHECKED | **Eight fields exactly**: Author, Dashboard ID, Gathering, Kind, Name, Saved At, Source, Synced At (DB `91738c36`). |
| WELL INBOX · Intake | DIRECTLY CHECKED | Separate DB beside it: `30e98cc4`, 7 props (Contact, Kind, Link, Name, Notes, Received, Status). Briefing's "eight-field ledger + separate Intake" = confirmed. |
| MONEY | DIRECTLY CHECKED | **Retired, renamed**: "RETIRED — MONEY (ledger snapshot, 2026-11-09)" (`6edb53bb`, 13 props). Workbook is the money source of record — the retirement is live in the workspace. Code at main 5396ceb still queries `NOTION_DB_MONEY` → route reads a retired snapshot until rerouted (owner decision; named gap in mirror map + UX derivations). |
| Registrations / Guest candidates | DIRECTLY CHECKED (adjacent) | "Create Well · Registrations & Check-ins" (9 props) and "Create Well · Guest candidates" (8 props) exist — candidate Notion-side targets for the unbuilt RSVP → FLOWS path. Named only; not wired. |
| Mirror map 2026-10-27 | NOT VERIFIED (absent) | Not in git/disk; Notion title search 2026-11-13 found no such page. Treated as unrecovered; superseded by docs/site-notion-mirror-map-2026-11-13.md. |
| Connection capability | DIRECTLY CHECKED (read surface) | This session exercised search + data-source reads successfully. Briefing claims Read/Update/Insert verified live — **Insert/Update NOT exercised by this lane** (read-only mission); no write capability was needed or used. |

**Collisions flagged:** multiple same-title DBs exist for PEOPLE (3), CONTENT (2+), EVENTS (4), INVENTORY (2). The dashboard disambiguates by env-configured id, never by title — correct practice; keep it that way. No action needed beyond not title-matching in any future automation.
