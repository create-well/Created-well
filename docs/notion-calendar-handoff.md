# Create Well calendar and Notion sync handoff

## Objective
Keep three distinct calendar layers aligned without exposing private member data:

1. **Shared Create Well calendar** — team-visible source for workshops, events, and operational dates.
2. **Personal calendars** — member-owned Google Calendars connected with Google OAuth.
3. **Availability layer** — the minimum event data a member explicitly elects to share with the team.

## Current application contract
- The shared calendar stays visible to every authenticated Create Well member.
- A personal Google Calendar connection is owned by the signed-in Supabase user.
- Google refresh tokens are encrypted at rest with `CALENDAR_TOKEN_ENCRYPTION_KEY`; the browser never receives a refresh token.
- Per-member sharing is opt-in, defaults to `off`, and supports:
  - `off`: no team visibility
  - `availability`: start/end and busy state only
  - `title-time`: start/end plus event title
  - `full-details`: start/end, title, location, and description
- Team-calendar reads return only the fields permitted by the owner’s selected level.

## Notion integration decision
**Do not make Notion the storage location for Google tokens or raw personal event details.** Notion should hold the planning record for shared work, while Google remains the source of truth for personal availability.

## Recommended Notion databases
### Calendar Sync Registry
One row per connected member calendar.
- `Member` — Person/relation
- `Profile Key` — text
- `Connection Status` — Connected, Needs Reconnect, Disconnected
- `Sharing Level` — Off, Availability, Title + Time, Full Details
- `Last Successful Sync` — date/time
- `Last Error` — text
- `Google Calendar ID` — text metadata only, never token values

### Shared Events
One row per Create Well event.
- `Name` — title
- `Start` / `End` — dates
- `Owner` — Person/relation
- `Category` — Workshop, CoFlow, Community, Operations
- `Google Event ID` — text
- `Sync Direction` — Notion → Shared Calendar, Shared Calendar → Notion, Manual
- `Last Synced At` — date/time
- `Sync Status` — Healthy, Conflict, Error

### Availability Windows
Derived, privacy-filtered planning data only.
- `Member` — Person/relation
- `Start` / `End` — dates
- `Status` — Busy
- `Source` — Google Calendar
- `Sharing Level Applied` — select
- `Refreshed At` — date/time

## Sync rules
- Google personal calendars → availability windows only, per sharing level.
- Notion shared events ↔ shared Create Well calendar using `Google Event ID` as the idempotency key.
- Never write a personal Google event into Notion unless its owner selects `full-details` and explicitly enables that workflow.
- Conflicts: preserve the newer `updated_at` value, mark the Notion row `Conflict`, and do not overwrite either source until resolved.
- Refresh cadence: on connection, on manual refresh, and a scheduled server job; record success/error state in the Sync Registry.

## Required configuration
- Google OAuth Authorized redirect URI: `https://dash.cr8w.com`
- Vercel secrets: `GCAL_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`
- Notion integration must be shared with the three databases above.

## Acceptance checks
1. A member connects Google Calendar on production and remains `Private` by default.
2. Switching to `Availability` exposes only busy time ranges to teammates.
3. Switching to `Title + Time` exposes no location or description.
4. Disconnecting removes the encrypted credential and all future team visibility.
5. A shared event can round-trip between Notion and the shared Create Well calendar without duplicates.
