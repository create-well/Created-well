# PR #27 History Source Decision: Interim Fail-Closed Hold

**Document status:** Draft for owner review
**Decision status:** Owner-approved interim hold; no canonical source selected for Well Notes or Care Loop Check-ins
**Accountable owner:** Monny
**Approval recorded:** 2026-10-30 23:12 PDT
**Repository:** `create-well/Created-well`
**Base:** `main` at `ad3b7240`
**Candidate:** `feature/canva-dashboard-v2` at `94bbb947`
**Worktree:** `/Users/monicablanco/.work/create-well/pr-27-auth-fix`

## Decision

The authoritative source for the Well Notes and Care Loop Check-ins history domain remains **unresolved**. Do not treat Google Sheets, Supabase, or Notion as the canonical source for that domain based only on repository prose, a workbook title, a static environment-variable name, or code that implements a sync path.

Keep PR #27 **open and unmerged**. The history-source-dependent reads, writes, and sync behavior proposed by the PR are not approved for activation until the owner selects one source, the exact non-secret runtime binding is documented, and the code and docs agree on one write authority.

This is an interim fail-closed decision, not a source binding. It does not state that no source is configured, that no history exists, or that an existing deployment has been changed. It authorizes no production configuration, permission, migration, deployment, or data changes. Preserve the current shared check-in history unchanged.

## Existing source policy that remains in force

- Notion remains operational source of truth for PEOPLE, FLOWS, MOVES, MONEY, and CONTENT.
- EVENTS and FEEDBACK remain supporting sources. Events reads stay fail-closed until an authoritative, non-secret document confirms the exact runtime source binding. Do not infer that Events is FLOWS or identify a source from a similar title.
- Task and check-in writes stay fail-closed until an authoritative mapping proves that a verified signed-in Supabase user maps to exactly one PEOPLE record. Do not infer identity from a name, email, or slug.
- MONEY remains read-only. General team views must not expose raw Notion properties, page/relation IDs, private check-in fields, or reflection notes.

This decision does not alter or extend the five Notion canonical sources.

## Evidence and unresolved conflict

This decision is grounded in source review of the local PR candidate, not a live-provider or authenticated runtime check:

- The PR description and `README.md` (lines 12–20) describe Google Sheets as operational and Supabase as a cache.
- `docs/workspace-sync.md` (lines 3–24) instead describes Supabase as the canonical write surface and Sheets as a mirror.
- `reports/sync-integrity-review-2026-09-25.md` is dated historical evidence. It describes Supabase as canonical at that time and records a direct Sheet test that had not appeared in Supabase then; it does not prove current runtime behavior.
- `api/workspaceSync.ts` contains both Supabase-to-Sheets and Sheets-to-Supabase paths, plus direct Sheet write helpers. The inspected `api/server.ts` call sites read through Sheets when configured and write directly to Sheets when configured, with Supabase fallbacks. Static code does not establish which runtime binding is active or authorized.
- README and `docs/workspace-sync.md` refer to different workbook bindings and inconsistent check-in tab defaults; the API default also differs from the sync documentation. Neither workbook is selected by this decision; no workbook identifier is repeated here.
- The inspected check-in helper accepts an author value from the request or falls back to `unknown`. No verified signed-in-user-to-exactly-one-PEOPLE mapping was identified in the inspected path.

Repository documentation, migration files, cron declarations, and environment-variable names do not prove live source binding, credential values, current sync execution, or authenticated access.

## Conditions to reconsider the hold

The owner may authorize a concrete source-of-truth decision in a separately reviewed update. Before PR #27 can merge or its history sync can be activated, all of the following must be true:

1. Monny explicitly selects the canonical source for Well Notes and Care Loop Check-ins.
2. A non-secret source-binding record identifies the exact owner-verified source and runtime binding. Do not guess or infer resource identifiers; never include credentials or secret environment values.
3. The application and documentation enforce one accountable write surface for each fact. The selected mirror/cache direction, conflict behavior, retention, and deletion behavior are explicit and tested. Existing shared history remains protected.
4. Check-in writes remain blocked until the verified Supabase user-to-PEOPLE mapping is documented and enforced; client-provided names or author labels are not identity proof.
5. An explicit privacy, authorization, and redaction review of history read/report endpoints verifies that private check-in content is restricted to approved audiences, only necessary fields are returned, and general team views remain minimized.
6. Events reads remain separately fail-closed until their own authoritative source binding is recorded.
7. The exact candidate receives focused checks and independent read-only review. Source review, pure/static tests, synthetic UI tests, deployed build, signed-out runtime, and authenticated/live-provider verification are reported as distinct evidence levels.
8. PR #27 remains unmerged until Monny separately authorizes the exact merge action after receiving the named PR, branch, commit, checks, and rollback path.

## Validation and limitations recorded for this draft

- Local build attempt: `npm run build` exited 127 with `vite: command not found`. Vite is not installed in this worktree; no package installation was performed. No npm, pnpm, or yarn lockfile was present, so a reproducible local install was not established.
- Authenticated runtime behavior was not tested. The owner-designated Test Well User and the required identity mapping were not confirmed.
- No production settings, deployments, permissions, source records, or shared history were changed.

## Change scope

This document records only the approved interim hold. It does not implement the hold in code, change the live deployment, resolve the source selection, or authorize a push or merge. Any code/configuration change requires its own scoped review and the existing project approval gates.
