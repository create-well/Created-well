# Supabase migrations — createdwell sync store

The schema of record for the createdwell sync store (Supabase project
ref `irtqcygriedvdijppntz`) lives here as reviewed migration files, not
as SQL pasted into the web editor. This structure was introduced under
G-54 / STACK-02 (2026-10-30). The app's older DDL files in `docs/`
(`live-sync-supabase.sql`, `live-sync-lease-supabase.sql`,
`sync-runs-supabase.sql`) remain the historical record; the migrations
below are their baseline capture.

## The baseline

| File | Captures | Executed |
| --- | --- | --- |
| `20261025000001_baseline_sync_store.sql` | `sync_delivery_state` (original columns), `sync_snapshots`, `sync_setup`; RLS on; default-ACL revocations; least-privilege service_role grants | 2026-10-25, schema gate |
| `20261027000001_sync_delivery_state_leases.sql` | Lease columns on `sync_delivery_state` (`lease_owner`, `lease_epoch`, `lease_expires_at`) | 2026-10-27, Monny's pass on the exact SQL |
| `20261030000001_sync_runs.sql` | `sync_runs` (G-35 run history) with the A-16 corrected grants: service_role INSERT/SELECT/DELETE only, sequence usage/select, zero anon/authenticated/public, RLS on | 2026-10-30, A-16 arc |

The baseline describes the live store. **Never re-apply baseline files
to production** — on the live store they are history. They exist so a
fresh project can rebuild the store exactly, and so every future change
is a diff against a known state.

## Adding a migration

1. `supabase migration new <slug>` creates the next timestamped file.
2. Write the full change in that one file: DDL, RLS, and grants
   together. This project's `pg_default_acl` hands anon and
   authenticated broad privileges on new public tables by default, so
   every new table file must revoke explicitly and grant service_role
   only what the code performs — the baseline files are the pattern.
   A migration with no grant section is unfinished.
3. Gates before the file is proposed: the change is reviewed like code
   (QA schema review), and any production schema change still runs the
   rev7 schema escalation — creating a production table is a schema
   delta even when idempotent.

## Applying (gated)

Applying migrations to production is a separate gated step through the
front door. Nothing in this repo applies itself.

```bash
supabase link --project-ref irtqcygriedvdijppntz
supabase db push            # applies only files the project has not recorded
supabase advisors           # grant/RLS lint; read before and after a push
```

Adopting CLI tracking on the already-live project (marking the three
baseline files as applied via `supabase migration repair`) is its own
gated operator step, deliberately not part of the STACK-02 build: until
it runs, `db push` against production would try to replay history and
must not be used there.

## Verification

Each migration file ends with the read-only checks for its own state.
The standing cross-check is the four-table grant comparison (QA's
STACK-03 probe): for `sync_delivery_state`, `sync_snapshots`,
`sync_setup`, and `sync_runs`, live grants must equal the baseline's
grant lines exactly — service_role only, RLS on everywhere, zero
anon/authenticated/public rows.
