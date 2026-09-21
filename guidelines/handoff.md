# Developer Handoff — CR8W Create Well

Last updated: 2026-09-21  
GitHub: `create-well/Created-well` main branch  
Production: `https://dash.cr8w.com`

---

## Status — what's done vs pending

| Item | Status |
|---|---|
| `@cr8w/design-system` CSS wired into App.tsx | ✅ Done — commit `25967b9` |
| Guidelines / tokens / setup docs updated | ✅ Done — commit `25967b9` |
| `kit-package.md` created | ✅ Done — commit `25967b9` |
| VITE_DEV_BYPASS — auth gate bypass for local dev | ✅ Done — commit `9a9694c` |
| `.env.local.example` for developer onboarding | ✅ Done — commit `9a9694c` |
| `CrButton.tsx` — Button source staged for kit publish | ✅ Done — `src/CrButton.tsx` |
| `notionNormalizer.ts` FLOW_STATUS_MAP — Idea/Ready/Approved/Happened | ✅ Done — past flows now correctly show archived |
| `seed-username-map.mjs` — KV table corrected to live table | ✅ Done — was writing to dead `kv_store_8dcd9693` |
| `seed-auth-user.mjs` + `seed-mb-admin.mjs` — Supabase project ID fix | ✅ Done — now point to `irtqcygriedvdijppntz` |
| Vercel FIGMA_REGISTRY_TOKEN update | ⏳ **Needs Vercel dashboard** |
| Google Calendar OAuth — redirect URIs | ⏳ **Needs GCP console** |
| Google Calendar OAuth — test users | ⏳ **Needs GCP console** |
| `@cr8w/design-system` Button — publish v0.0.3 | ⏳ **Needs Figma Make kit session** |

---

## 1. Local development setup (new developer)

```bash
git clone https://github.com/create-well/Created-well.git
cd Created-well
cp .env.local.example .env.local   # set VITE_DEV_BYPASS=true (already set)
npm install
npm run dev
```

No Supabase credentials needed — `VITE_DEV_BYPASS=true` skips the login screen and loads the `monny` profile directly.

To sign in as a different profile, change `VITE_DEV_BYPASS` in `.env.local` to any profile key:
`sunshine` | `monny` | `bingle` | `omar` | `pia` | `event-support`

---

## 2. Vercel — FIGMA_REGISTRY_TOKEN (action needed)

The Figma registry token auto-rotates in the sandbox. Vercel needs the current value to install `@cr8w/design-system` during CI builds.

**Steps:**

1. Open [vercel.com/dashboard](https://vercel.com) → the `Created-well` project → **Settings** → **Environment Variables**
2. Find `FIGMA_REGISTRY_TOKEN` (or create it if missing)
3. Set the value to the current sandbox token — **copy it from `.npmrc`**:
   ```
   figi_EzhrPi1OmRGvcgU35iPRYwDs3ihS2N-CWAoZoq57
   ```
4. Check **Production**, **Preview**, and **Development** environments
5. Save → trigger a new deployment (or redeploy the latest)

Note: The sandbox `.npmrc` rotates automatically. Each time you see a fresh `figi_...` or `figp_...` token in `.npmrc`, update Vercel to match.

---

## 3. Google Calendar OAuth (action needed)

### 3a — Add authorized redirect URIs (fixes HTTP 400 redirect_uri_mismatch)

1. Open [Google Cloud Console](https://console.cloud.google.com) → correct project → **APIs & Services** → **Credentials**
2. Click the OAuth 2.0 Client ID used by the app
3. Under **Authorized redirect URIs**, add:
   ```
   https://dash.cr8w.com
   ```
   Also add any Vercel preview URLs your team uses, e.g.:
   ```
   https://created-well.vercel.app
   https://created-well-*.vercel.app
   ```
4. Click **Save**

### 3b — Add test users (fixes HTTP 403 access_denied)

The OAuth app is in **Testing** mode, so Google only allows listed test accounts.

1. Same GCP project → **APIs & Services** → **OAuth consent screen**
2. Scroll to **Test users** section → click **Add users**
3. Add every team member's Google account email:
   - `mb@tablante.com`
   - `monny@createwell.co`
   - Add sunshine / bingle / omar / pia emails here too
4. Click **Save**

Until the app is published (moved out of Testing mode), only listed test users can complete the Google Calendar OAuth flow.

---

## 4. Supabase — seed scripts (reference)

All seed scripts are in `scripts/`. Run them server-side only — never in the browser. Requires `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard.

```bash
# Seed the username → email KV map (idempotent)
SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-username-map.mjs

# Seed a test user (monny profile)
SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-auth-user.mjs

# Seed the admin account
SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-mb-admin.mjs
```

Service role key location: [Supabase dashboard](https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api) → API → service_role (secret).

All three scripts now reference the correct production project `irtqcygriedvdijppntz`.

---

## 5. @cr8w/design-system — publish v0.0.3 (action needed)

The Button source is staged at `src/CrButton.tsx`. To publish:

1. Open the Figma Make project in kit authoring mode
2. Copy `src/CrButton.tsx` into the kit source
3. Update the kit's `src/index.ts` to export `Button` from the new file (replacing the `() => null` stub)
4. Bump `version` in the kit's `package.json` to `0.0.3`
5. Publish through the Figma Make kit publish flow
6. Update `@cr8w/design-system` version in this project's `package.json` from `0.0.2` → `0.0.3`
7. Run `npm install` and verify the Button renders

**Button API (v0.0.3):**

```tsx
import { Button } from '@cr8w/design-system';

// variant: "primary" | "secondary" | "ghost" (default: "primary")
// size: "sm" | "md" | "lg"               (default: "md")

<Button variant="primary">Save changes</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" disabled>Loading...</Button>
```

---

## 6. Environment variables reference

| Variable | Where | Purpose |
|---|---|---|
| `VITE_DEV_BYPASS` | `.env.local` (gitignored) | Skip auth gate in local dev |
| `FIGMA_REGISTRY_TOKEN` | Vercel project settings | Install `@cr8w/design-system` in CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Shell only — never commit | Seed scripts only |
| `VITE_API_BASE` | `.env.local` (optional) | Override Edge Function base for local testing |

---

## 7. Figma registry — token rotation

The sandbox `.npmrc` token rotates automatically. When you see a new `figi_...` or `figp_...` token in `.npmrc`:

1. Copy the new token
2. Update `FIGMA_REGISTRY_TOKEN` in Vercel (see §2)
3. GitHub `.npmrc` already uses `${FIGMA_REGISTRY_TOKEN}` — no GitHub change needed
