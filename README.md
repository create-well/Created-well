
  # created-well

  This is a code bundle for created-well. The original project is available at https://www.figma.com/design/H5p9jZz5h7VwzE0WzbBQ5G/created-well.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Well Notes and Care Loop history source

The historical Well Notes and Care Loop Check-ins surface now supports **Google Sheets as the operational source**. Supabase stores a normalized cache for dashboard reads and reporting; it is not a second editable source. The workbook created for this project is [Created Well — Well Notes & Check-ins](https://docs.google.com/spreadsheets/d/15guCrFchCM2lV-7DJf8e5KXJnmN0oBBrYlVsdb1ZNkw/edit), with `Well Notes`, `Check-ins`, and `Sync Meta` tabs.

Configure the deployed server with `GOOGLE_WORKSPACE_SPREADSHEET_ID=15guCrFchCM2lV-7DJf8e5KXJnmN0oBBrYlVsdb1ZNkw`, `GOOGLE_WORKSPACE_NOTES_SHEET=Well Notes`, `GOOGLE_WORKSPACE_CHECKINS_SHEET=Check-ins`, and either a short-lived `GOOGLE_SHEETS_ACCESS_TOKEN` for controlled environments or a `GOOGLE_SERVICE_ACCOUNT_JSON` credential whose account has access to the workbook. Keep all Google credentials server-side; the browser never receives them. The scheduled `/api/server/workspace-sync` route pulls the workbook into the Supabase cache every five minutes when `CRON_SECRET` and the Workspace credentials are present.

With the Workspace source configured, dashboard reads and historical reports refresh the cache from Sheets first. Well Note creation and landing updates append or update the Sheet before refreshing the cache. Check-in deletion is intentionally blocked through the dashboard because Google Sheets is the operational write surface; remove or mark the row in the `Check-ins` tab, then allow the sync to refresh the cache. The API exposes `/api/server/reports/history` for JSON, `/api/server/reports/history.csv` for CSV, and `/api/server/reports/conflicts` for any future conflict records.

The Supabase migration is stored at `supabase/migrations/20260925_create_well_history_workspace_sync.sql`. It creates normalized history tables, sync run tracking, conflict tracking, export tracking, a weekly history summary view, and a safe legacy KV backfill.
