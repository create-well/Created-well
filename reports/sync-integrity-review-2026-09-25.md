# Created Well Sync Integrity Review — 2026-09-25

## Scope

This review covers the canonical Supabase history tables, the operational Google Sheets workbook, open conflict records, the generated CSV report, and the current production deployment.

## Current integrity state

| Surface | Result | Detail |
|---|---|---|
| Supabase `well_notes` | Pass | 1 canonical row before the direct Sheet test: `1790331050720`. |
| Supabase `care_loop_checkins` | Pass | 0 rows. |
| Supabase `workspace_sync_conflicts` | Pass | 0 open or historical conflict rows. |
| Supabase `workspace_sync_runs` | Informational | 0 runs; the deployed sync credential is not configured. |
| Google Sheet `Well Notes` | Pass | 2 rows after the direct test. The second row is `1790335350995`, `Direct Sheet sync test — Flow remains open.` |
| Google Sheet `Check-ins` | Pass | Canonical headers present; 0 data rows. |
| CSV report | Pass | Generated from the verified Supabase canonical history before the direct Sheet test. |

## Direct Sheet test

A new Well Note was appended directly to the `Well Notes` tab at `2026-09-25T11:22:30Z` with ID `1790335350995`. The write was confirmed by reading the workbook immediately afterward. It has **not yet appeared in the Supabase cache or dashboard** because the current production deployment does not contain the feature branch and no Google service-account or Sheets access credential is configured in Vercel.

## Production deployment finding

The current production deployment serves an older `main` commit. `/api/server/reports/history` returns `404`, and `/api/dashboard` returns `503` because the production Notion token is invalid. Therefore, a successful end-to-end production dashboard verification is not possible until the feature branch is deployed and Workspace credentials are added.

## Schedule change

The feature branch now changes the Vercel cron from every five minutes to once daily at `09:00 UTC` (`0 9 * * *`). This is approximately 02:00 Pacific during daylight time. The schedule will become active only after the branch is deployed to the Vercel project.

## Recommended activation sequence

Add a server-side `GOOGLE_SERVICE_ACCOUNT_JSON` credential to Vercel production, grant that service account access to the workbook, deploy or merge `feature/canva-dashboard-v2`, trigger `/api/server/workspace-sync` once, and then verify that Well Note `1790335350995` appears in `well_notes` and `/api/server/reports/history`. Do not place the credential in the browser or repository.
