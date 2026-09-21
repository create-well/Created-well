# Developer Handoff & Source of Truth — CR8W Create Well

**Last Updated:** 2026-09-21  
**GitHub:** `create-well/Created-well` main branch  
**Production URL:** `https://dash.cr8w.com`  
**API Base:** `https://dash.cr8w.com/api/server/`

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

## 2. Canonical Source of Truth Registry

This table lists every authoritative identifier, database, and infrastructure resource across Notion, Supabase, and Vercel.

| Label | ID / Resource | Type | Status | Owner | Write Policy | Consuming Files |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MOVES (hub)** | `49faf1111bbe43458c3e6a4dcec63b5c` | Notion DB | Active | Monny | read-write | `src/config/notion.ts`, `api/dashboard.ts`, `api/_notionWriter.ts` |
| **PEOPLE (hub)** | `81fc482da44d43cb9c426952654944ab` | Notion DB | Active | Monny | read-write | `src/config/notion.ts`, `api/dashboard.ts`, `api/_notionWriter.ts` |
| **FLOWS (hub)** | `8d9ebf0c04cb47219ca2e3942cee6212` | Notion DB | Active | Monny | read-write | `src/config/notion.ts`, `api/dashboard.ts`, `api/_notionWriter.ts` |
| **CONTENT (hub)** | `08a0e011142a4512a3dc8075800db7db` | Notion DB | Active | Monny | read-write | `src/config/notion.ts`, `api/dashboard.ts`, `api/_notionWriter.ts` |
| **MONEY (operational)** | `acc5fe2fdeca4f8989e179e32ddbc24d` | Notion DB | Active | Monny | read-only | `src/config/notion.ts`, `api/dashboard.ts`, `src/lib/notionNormalizer.ts` |
| **KV Cache Table** | `kv_store_dabe1c74` | Supabase KV | Active | Omar | read-write | `src/config/sync.ts`, `api/dashboard.ts`, `api/_server.ts` |
| **Supabase Project** | `irtqcygriedvdijppntz` | Supabase Project | Active | Monny/Omar | admin | `src/config/env.ts`, `scripts/*.mjs` |
| **Vercel Project** | `prj_6iGQ6SxXEWLiS8MuJrKBJZojyccG` | Vercel Deployment | Active | Monny | auto-deploy | `vercel.json` |
| **Figma Make File** | `H5p9jZz5h7VwzE0WzbBQ5G` | Figma Canvas | Active | Team | design | `guidelines/FigmaMakePrompt.md` |

### Blocked & Deprecated Identifiers (DO NOT USE)
- **Dead KV Table:** `kv_store_8dcd9693` — deprecated legacy store. Never write or query this table.
- **Wrong Supabase Project:** `axntibrdivccycxdwlzk` — deprecated prototype environment.
- **Operational Five Notion DBs:** 
  - `MOVES_OPS`: `3da8c56469e948e489836ea8773d6354`
  - `PEOPLE_OPS`: `ea53d1eddde243adb0344582cbeaf4c5`
  - `FLOWS_OPS`: `17d69cdfab1f4bb78ba197ec0a829ff5`
  - `CONTENT_OPS`: `bffdc8056b984515935b9496524198f8`  
  *(These belong strictly to Backend Hub edge-sync scripts and are guarded against by `assertNotionIdNotBlocked()`)*.

---

## 3. Hardcoded Config Architecture (`src/config/`)

To prevent drift and silent failures across Vercel Functions and client builds, all settings are centralized under `@/config/`:

1. **`notion.ts`**: Canonical database IDs, write policies (`MONEY` read-only), Notion workspace pages, and `assertNotionIdNotBlocked()` runtime assertions.
2. **`env.ts`**: Dual-sided environment variable accessors. Client uses `ENV` (via `import.meta.env`); server functions use `SERVER_ENV` with `assertRequired()`.
3. **`profiles.ts`**: Authoritative profiles definition for all 6 team members (`sunshine`, `monny`, `bingle`, `omar`, `pia`, `event-support`). Eliminates discrepancies in `AuthGate`, `LoginGate`, and `data.ts`.\n4. **`routes.ts`**: Routing map linking paths (`/`, `/moves`, `/care`, `/flows`, `/money`, `/decisions`, `/system`, `/team`) to page components, required permissions, and primary Notion databases.
5. **`content.ts`**: Section titles, fallback quotes, glossary terms, event labels, and money stage mappings.
6. **`sync.ts`**: Sync order (`MOVES` → `PEOPLE` → `FLOWS` → `CONTENT` → `MONEY`), cache TTLs (`55s` in-memory, `60s` CDN), `assertWritable()` guard, and 15 canonical KV keys.

---

## 4. Vercel — FIGMA_REGISTRY_TOKEN (action needed)

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

---

## 5. Google Calendar OAuth (action needed)

### 5a — Add authorized redirect URIs (fixes HTTP 400 redirect_uri_mismatch)

1. Open [Google Cloud Console](https://console.cloud.google.com) → correct project → **APIs & Services** → **Credentials**
2. Click the OAuth 2.0 Client ID used by the app
3. Under **Authorized redirect URIs**, add:
   ```
   https://dash.cr8w.com
   https://www.cr8w.com
   ```
4. Click **Save**

### 5b — Add test users (fixes HTTP 403 access_denied)

1. Same GCP project → **APIs & Services** → **OAuth consent screen**
2. Scroll to **Test users** section → click **Add users**
3. Add every team member's Google account email (`mb@tablante.com`, `monny@createwell.co`, etc.)
4. Click **Save**
