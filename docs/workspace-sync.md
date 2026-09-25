# Create Well history and Workspace mirror

## Source of truth

Supabase is the canonical write surface. The normalized tables are `public.well_notes` and `public.care_loop_checkins`. The older `public.kv_store_dabe1c74` rows remain available only as a compatibility cache for older dashboard modules.

The migration backfills the existing Well Notes JSON-string payload and preserves the legacy ID, created timestamp, content, and landed state. Co-Flow Check-ins are ready for backfill when legacy rows exist.

## Live mirror

Vercel runs `GET /api/server/workspace-sync` every five minutes. The adapter maintains two Google Sheets tabs:

- `Well Notes`: `id`, `content`, `landed`, `created_at`, `updated_at`, `source_hash`
- `Care Loop Check-ins`: `id`, `week_of`, `author`, `confirm_time`, `location_suggestion`, `agenda_items`, `mood`, `time_preference`, `notes`, `created_at`, `updated_at`, `source_hash`

Configure the Vercel project with `GOOGLE_WORKSPACE_SPREADSHEET_ID`, plus either `GOOGLE_SHEETS_ACCESS_TOKEN` or `GOOGLE_SERVICE_ACCOUNT_JSON`. For a service account, share the target workbook with the service account email as an editor. `GOOGLE_WORKSPACE_NOTES_SHEET` and `GOOGLE_WORKSPACE_CHECKINS_SHEET` are optional and default to `Well Notes` and `Care Loop Check-ins`.

The confirmed workbook is [Create Well — History Mirror](https://docs.google.com/spreadsheets/d/1_ElHNCUl-SdI7vc4cRFJyBFP3ICV0iYfhahYb5nKFlg/edit), with spreadsheet ID `1_ElHNCUl-SdI7vc4cRFJyBFP3ICV0iYfhahYb5nKFlg`. Its two tabs are currently empty; the first configured sync will write the headers and canonical history rows.

`CRON_SECRET` is optional. When present, the sync endpoint requires `Authorization: Bearer $CRON_SECRET`; Vercel Cron supplies this header when configured in the project settings.

## Conflict rule

Every canonical row carries a deterministic `source_hash`. A sync first reads the full mirror and checks whether a row changed in Sheets without its source hash changing. If any conflict is found, the entire sync run stops before any Sheet row is written. Conflicts are recorded in `public.workspace_sync_conflicts` and surfaced in System Health. This follows **one write surface per fact** and **FLOWING > FORCING**: no stale mirror value silently replaces a newer canonical fact.

## Reports

- `GET /api/server/reports/history` returns JSON history and summary counts.
- `GET /api/server/reports/history.csv` downloads a combined historical CSV for Well Notes and Care Loop Check-ins.
- `GET /api/server/reports/conflicts` returns open mirror conflicts.

The System Health view now shows canonical history counts, landed currents, open conflicts, and a CSV export action. Google Docs reporting remains an intentional next layer because it requires a document destination and approved Workspace credential; it should consume the same report payload rather than create a second data model.

## Verification

The migration is applied to the active `createdwell` Supabase project. Current backfill result: 1 Well Note, 0 Care Loop Check-ins, 0 sync runs. The frontend production build passes. The direct preview audit found no browser console errors; true 375px screenshot verification remains pending because the current preview browser session has no viewport-resize tool.
