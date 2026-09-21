# Plan: Community Events Hub + Pia Profile + Backend Sync

## Context

The Geyser countdown was hardcoded to April 15, 2026 (`getDaysToLaunch()` in `data.ts`). That date has passed. The team's current programming focus has shifted from the Geyser launch event to recurring community formats: **Podyaps** (Yapcasts/Playdates), **Book Club**, and **Workshops**. The site needs to reflect this shift.

Pia is fully defined in the data layer (`_VALID_PROFILES`, `PERSONS`, `HD_PROFILES`, `TASK_ROLES` in `data.ts`) but may not be rendering in every UI surface that lists team members. The goal is to make Pia's presence consistent across the whole app — not just as a dev bypass profile.

The backend already has the right Notion integration shape (`api/dashboard.ts` + `notionNormalizer.ts`). The gaps are: MONEY database is excluded from the dashboard payload ("Phase 2"), and there is no explicit filtering for community event types (Yapcast, Playdate, Workshop, Book Club) within the FLOWS query.

---

## What Changes

### 1. Replace Geyser countdown with dynamic "next event" countdown

**File:** `src/app/components/data.ts`

- Replace `getDaysToLaunch()` (hardcoded to `2026-04-15`) with `getDaysToNextEvent(events: CoFlowDate[])` that computes days to the nearest upcoming FLOW from the live dashboard data.
- Add a `COMMUNITY_EVENT_TYPES` constant: `['Yapcast', 'Playdate', 'Book Club', 'Workshop']` — matches FLOWS `Type` select values from the operational five schema.

### 2. Replace GeyserView with CommunityEventsView

**File:** `src/app/components/GeyserView.tsx` → repurpose in-place (rename export, keep file so HubView references don't break initially)

**New file:** `src/app/components/CommunityEventsView.tsx`

Tabs: **Upcoming** | **Podyaps** | **Book Club + Workshops** | **Tasks** | **Team**

- **Upcoming tab**: Dynamic countdown to next event (uses `getDaysToNextEvent`), event cards pulled from `DashboardContext` FLOWS data filtered to community event types, empty state if none.
- **Podyaps tab**: FLOWS filtered to `Type = Yapcast | Playdate`, sorted by date, each card shows title / date / host / guest list / recording link.
- **Book Club + Workshops tab**: FLOWS filtered to `Type = Workshop | Book Club`, calendar-style list, RSVP/invite count, Bingle's role surfaced prominently (Bingle's TASK_ROLE is "In-Person — space-holding, community, workshops").
- **Tasks tab**: Identical to GeyserView's Tasks tab (filterable MOVES list), reuse `CoFlowD8sView`-style filter UI.
- **Team tab**: Grid of all PERSONS including Pia — reuse the existing team-card pattern from GeyserView.

### 3. Update HubView hero / navigation tile

**File:** `src/app/components/HubView.tsx`

- Replace the Geyser tile / countdown display with a "What's Coming" hero section showing the next 1-2 community events from FLOWS.
- Change the nav tile that currently routes to `'geyser'` to route to `'community-events'`.
- Ensure the tile label reads "Community Events" (or "What's Flowing") not "Geyser".

### 4. Add CommunityEventsView to navigation dispatch

**File:** `src/app/components/ViewShell.tsx` (or wherever HubView's `onNavigate` view map lives)

- Add `'community-events'` → `<CommunityEventsView />` to the view switch/map.
- Keep `'geyser'` as a soft alias pointing to the same component for a cycle (no 404s mid-session).

### 5. Pia in every team-listing surface

Pia exists in `PERSONS` and `TASK_ROLES` — audit these render sites and fix any that exclude her:

- **GeyserView** `team-grid` loop: renders `Object.entries(PERSONS)` — Pia included automatically. ✓ (no change needed once CommunityEventsView inherits this)
- **ArriveState.tsx**: Profile picker screen — verify it iterates `_VALID_PROFILES` or `PERSONS` keys. If it hardcodes a subset, add `'pia'`.
- **LoginGate.tsx**: Same check — if profile dropdown or button list is hardcoded, add Pia.
- **PersonView.tsx**: Shows HD profile for a selected person — verify `HD_PROFILES['pia']` renders correctly (data exists, just need UI to not guard against it).
- **TopNav.tsx**: If there is a user switcher or avatar display, Pia should appear with color `#9B3A5A` and emoji 🌸.
- **MBodyWidget.tsx**: If it shows a "who's online / team members" section, ensure it uses `PERSONS` not a hardcoded subset.

### 6. Add MONEY database to dashboard payload

**File:** `api/dashboard.ts`

- Uncomment / activate the MONEY query (currently marked "Phase 2" in comments).
- Use env var `NOTION_DB_MONEY` → normalizer returns raw MONEY rows.
- Add `money: MoneyRecord[]` to `DashboardPayload` type in `src/types/dashboard.ts`.
- `DashboardContext` passes through `money` alongside the existing five collections.

**File:** `src/lib/notionNormalizer.ts`

- Add `normalizeMoney(page) → MoneyRecord` — properties: `Name`, `Amount`, `Kind`, `Date`, `Flow (relation)`, `Doc (url)`.

### 7. FLOWS query: add community-type filter hint

**File:** `api/dashboard.ts`

- The existing FLOWS query fetches all FLOWS. Add a second targeted query (or a client-side derived collection) for `communityFlows` filtered to `Type in [Yapcast, Playdate, Workshop, Book Club]`.
- Expose as `communityFlows: CoFlowDate[]` on `DashboardPayload` so `CommunityEventsView` can use it directly without client-side filtering on every render.

### 8. Vercel environment variables (documentation only — no code change)

These must be set in Vercel Project Settings → Environment Variables (all environments):

| Variable | Value (from API Registry) |
|---|---|
| `NOTION_DB_MOVES` | `3da8c56469e9...` |
| `NOTION_DB_PEOPLE` | `ea53d1ed...` |
| `NOTION_DB_FLOWS` | `17d69cdf...` |
| `NOTION_DB_CONTENT` | `bffdc805...` |
| `NOTION_DB_MONEY` | `acc5fe2f...` |
| `NOTION_SECRET` | (integration token) |
| `SUPABASE_URL` | `https://irtqcygriedvdijppntz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key) |
| `FIGMA_REGISTRY_TOKEN` | `figi_EzhrPi1OmRGvcgU35iPRYwDs3ihS2N-CWAoZoq57` |

---

## File Change Summary

| File | Action |
|---|---|
| `src/app/components/data.ts` | Replace `getDaysToLaunch()`, add `COMMUNITY_EVENT_TYPES` |
| `src/app/components/CommunityEventsView.tsx` | **Create** — new community events hub component |
| `src/app/components/GeyserView.tsx` | Remove or archive (redirect alias to new view) |
| `src/app/components/HubView.tsx` | Update hero + nav tile |
| `src/app/components/ViewShell.tsx` | Add `'community-events'` to view dispatch |
| `src/app/components/ArriveState.tsx` | Add Pia to profile picker if hardcoded |
| `src/app/components/LoginGate.tsx` | Add Pia to profile list if hardcoded |
| `src/app/components/TopNav.tsx` | Verify Pia renders in user switcher |
| `src/types/dashboard.ts` | Add `money: MoneyRecord[]`, `communityFlows: CoFlowDate[]` |
| `src/lib/notionNormalizer.ts` | Add `normalizeMoney()` |
| `api/dashboard.ts` | Activate MONEY query, add `communityFlows` derived query |

---

## Existing utilities to reuse

- `PERSONS`, `TASK_ROLES`, `HD_PROFILES` — all in `src/app/components/data.ts`. Do not duplicate.
- `CoFlowD8sView.tsx` — existing FLOWS list component; reuse for Podyaps and Book Club tabs.
- `WorkshopsView.tsx` — already exists; fold its content into CommunityEventsView's Workshop tab rather than maintaining a separate view.
- `notionNormalizer.ts` `normalizeFlow()` — existing normalizer for FLOWS; add `type` field mapping to it (already in Notion schema, just not surfaced in the normalized type).
- `DashboardContext` — already provides `flows` array; `communityFlows` will be a derived slice.

---

## Verification

1. **Dev bypass:** Set `VITE_DEV_BYPASS=pia` → app loads, Pia's color (`#9B3A5A`) and emoji (🌸) appear in nav/profile surfaces. PersonView shows Pia's HD profile (Reflector, Lunar Authority).
2. **Community Events view:** HubView tile navigates to CommunityEventsView. With no live Notion data, empty states render cleanly. With mock FLOWS data including a Yapcast entry, it appears in the Podyaps tab and the countdown shows days to that flow.
3. **MONEY on dashboard:** `GET /api/dashboard` response includes `money` array (can be empty if no NOTION_DB_MONEY set, but key must exist).
4. **Geyser not shown:** Navigating through the app, no view references the April 15 2026 countdown date. No dead countdown (negative days) renders anywhere.
5. **All profiles in team grid:** CommunityEventsView's Team tab shows five cards: Sunshine, Monny, Bingle, Omar, Pia.
