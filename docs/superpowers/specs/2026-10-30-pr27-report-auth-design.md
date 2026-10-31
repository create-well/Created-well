# PR #27 report endpoint authentication design

**Date:** 2026-10-30  
**Status:** Design approved; awaiting review of this written spec before implementation.

## Context and problem

PR #27 adds history-report and workspace-conflict endpoints that query Supabase with the server-side service-role client. `dashboardAuth` currently treats the public Supabase publishable key as an acceptable bearer credential. A publishable key identifies the project, not the signed-in user, so it must not authorize access to these records. The active `AuthGate` already uses Supabase Auth, persists a session under `cr8w_supabase_auth`, and has an admin allowlist containing `mb@tablante.com`.

The CodeQL check on PR #27 reported three new high-severity alerts titled “User-controlled bypass of security check,” with annotations in `api/server.ts`. The code-scanning alerts endpoint was unavailable to this session, so CodeQL must be rerun after the fix and any remaining alerts must be reviewed rather than suppressed automatically.

## Approaches considered

1. **Verified Supabase user token plus server-side admin allowlist (selected).** Reuse the existing login, validate its access token on the server, and authorize only the existing admin email. This preserves authenticated report access without treating a project key as identity.
2. **Server-to-server secret only.** Require `CRON_SECRET` for reports and conflicts. This is simpler but disables the browser-facing System page reports until a separate auth flow is added.
3. **Vercel-level protection.** Put access control at the deployment edge. This would require separate project configuration and would not provide route-level authorization for the service-role queries.

## Approved design

- For `/reports/history`, `/reports/history.csv`, and `/reports/conflicts`, make the server authorization asynchronous. Accept a configured `CRON_SECRET` for trusted server-to-server requests; otherwise require a bearer access token that Supabase Auth validates using `supabase().auth.getUser(token)`. Only authorize a verified user whose normalized email is in the server-side admin allowlist matching `AuthGate.ADMIN_EMAILS` (`mb@tablante.com`). Never trust the publishable key, local-storage profile, or client-side admin flag as proof of identity.
- Update the report calls in `src/app/components/api.ts` and the CSV-download request to send the persisted Supabase Auth access token. If no user token exists, do not substitute the publishable key on report routes. Leave existing non-report API calls and their current headers unchanged.
- Keep `/workspace-sync` protected by the existing fail-closed `cronAuth`; do not change unrelated route behavior.
- Return 401 for missing/invalid/expired user credentials, 403 for a verified non-admin, and 503 when required auth verification configuration is unavailable. Preserve the existing CRON-secret path for trusted automation.

## Test and verification plan

Add focused tests for missing, invalid, expired, non-admin, allowlisted-admin, and CRON credentials. Exercise the protected JSON, CSV, and conflict routes. Confirm a non-report endpoint retains its existing behavior and that no report request falls back to the publishable key. Run the repository's available local tests and typecheck/build where dependencies permit, then push the PR branch so GitHub reruns CodeQL. Inspect any remaining CodeQL alerts on their own merits; do not dismiss or suppress them without evidence.

## Scope and non-goals

The implementation is limited to report authentication in `api/server.ts`, the corresponding report-request headers in `src/app/components/api.ts`, and focused tests. It does not change unrelated API authorization, database policies, login UX, or Vercel settings for PR #26. No new dependency is planned. The PR #26 preview cannot be retriggered until the Vercel connector is authorized.
