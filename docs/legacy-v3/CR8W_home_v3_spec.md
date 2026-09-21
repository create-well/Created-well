# cr8w home · v3 specification
> FLOWING > FORCING · july 2026

## What v3 is

v3 is not a rebuild. It is making the current dashboard solid and calm for a 4-person team
(monny, sunshine, bingle, omar), on the stack that already exists.

Do not add new Postgres tables. Do not switch hosts. Do not re-architect.

## Non-negotiable constraints (carried from v2)

- **Backend stays KV.** One table `kv_store_8dcd9693`, JSON blobs via Edge Function `server`
  at `/make-server-8dcd9693/...`. New features = new KV keys + new server routes.
- **Host stays Vercel.** cr8w.com, auto-deploy on push to main.
- **Supabase ref `axntibrdivccycxdwlzk`.** No new project.
- **Auth stays Supabase email/password**, profile resolved by `EMAIL_PROFILE_MAP`.

## v3 scope (do these, in order)

1. **Stability first.** Fix render bugs (done: well-note droplet emoji), add `.gitignore`
   (done), kill stale references (done: Supabase ref comment).
2. **Security baseline.** RLS policy on KV table, pinned function search_path, revoked
   RPC surface (done). Enable leaked-password protection in Supabase Auth (manual toggle).
3. **Reduce localStorage-as-truth.** `visibilityDial`, `cr8w_user_profile`,
   `cr8w_personal_profiles` currently live in localStorage. Move the shared ones into KV
   so state survives across devices. Keep device-only prefs local.
4. **Presence / read-state: NOT NOW.** Real-time presence and read receipts are a want,
   not a need for 4 people pre-launch. Park until the team is actually using it daily.
5. **Component size cleanup (optional).** HubView.tsx (138KB), WorkshopsView.tsx (111KB),
   CoFlowD8sView.tsx (72KB), MessageDrawer.tsx (72KB) are large. Split only if a change
   in one gets painful. Not urgent.

## Explicitly out of scope for v3

- New relational tables (presence, read_receipts, ripples, user_preferences, sync_status,
  absorption_checks). These fight the KV pattern. Do not build them.
- Host migration.
- Full design overhaul. Brand reference is locked.

## Definition of done for v3

The four team members can log in, see their own profile, use the tabs, and drop well-notes
without hitting a visible bug or losing state on refresh. That is the bar. Ship to that.
