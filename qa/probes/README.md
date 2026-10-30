# QA probe pack (STACK-03)

The post-merge probes QA used to run by hand, scripted. Three probes, one
command, VERIFY-shaped output (one line per leg: PASS / FAIL /
NOT VERIFIED plus evidence, then a summary count).

## Run it

```
cd qa/probes
npm install
npx playwright install chromium   # once per machine
npm run probes                    # exit 1 on any FAIL
npm run probes:all                # also exit 1 when a leg is NOT VERIFIED
```

The pack is standalone: its own package.json, nothing wired into the app
build, the app suite, or the app's dependency tree.

Environment note: the browser probes need an egress path Chromium can
use (direct, or a standard HTTP proxy passed through the environment).
The anon-grants probe needs only node's fetch. In the QA VM, scripted
Chromium cannot traverse the sandbox egress proxy (proven 2026-10-30:
curl and node fetch pass, Chromium fails the tunnel in every proxy
configuration), so there the browser probes report their surface legs
with that error and the live browser legs run through the Muse browser
route instead; on a normal-egress machine the pack runs as written.

## Probes

1. **anon-grants** — the sync store grant posture. With the publishable
   anon key, each of sync_runs, sync_delivery_state, sync_snapshots,
   sync_setup must answer 401 with Postgres 42501 (no anon grant; the
   live-sync-sql-v2 posture, and the A-16 ruling of 2026-10-30). A 200
   empty list means a table carries the project default grants and RLS
   alone is holding the line: that is a FAIL.
2. **home-counts** — the signed-in Home care counts, the PR #64 landing
   probe. Needs care panel present; "Unanswered asks" renders the
   expected count beside "Consent gaps". Expected counts are parameters
   (below), set from the landing receipt's census, not hard truths.
   Before PR #64 lands, the asks leg FAILs on production by design.
3. **fe13-drawer** — the FE-13 render legs that stayed NOT VERIFIED at
   scoring: drawer geometry (width min(100vw, 420px), off-canvas closed,
   full width at a phone viewport), backdrop (z 1000,
   rgba(38, 24, 18, 0.45)), composer present, backdrop-click and Escape
   close paths. Run it against the FE-13 preview origin or production
   after FE-13 lands; against a pre-FE-13 surface the geometry legs FAIL
   by design.

Each browser probe also runs a surface leg with no credentials: the
origin loads and the sign-in gate renders. Signed-in legs report
NOT VERIFIED, naming the missing env, when credentials are not set.

## Environment (never committed)

| Variable | Used by | Notes |
| --- | --- | --- |
| CW_SUPABASE_URL | anon-grants | the store project origin |
| CW_SUPABASE_ANON_KEY | anon-grants | the publishable anon key |
| CW_QA_ID | home-counts, fe13-drawer | sign-in identifier (email or username) |
| CW_QA_PASSWORD | home-counts, fe13-drawer | sign-in password |
| CW_QA_BASE_URL | home-counts | default https://createdwell.vercel.app |
| CW_FE13_BASE_URL | fe13-drawer | the FE-13 preview origin, or production after landing |
| CW_EXPECT_ASKS | home-counts | default "9 of 65" (census 2026-10-30) |
| CW_EXPECT_CONSENT | home-counts | default "28 of 28" (census 2026-10-30) |

## Rules the pack keeps

- Read-only. The probes open, read, and close; they send nothing and
  write nothing. Drawer probes open and close the drawer only.
- Credentials come from the environment at run time. Nothing secret is
  committed, logged, or printed; probe output carries statuses and
  counts only.
- No fixtures. The probes read live surfaces. If a future probe needs
  fixture data, it follows the placeholder standard (a `[]` marker plus
  the missing thing's name, listed in its output) and a fixture never
  satisfies a count, gate, or freshness claim.
