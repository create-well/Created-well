# Create Well (CR8W) — Systems Handoff & Source of Truth

**Last Updated:** 2026-09-21  
**Target Repository:** `create-well/Created-well` (Team: `monnylog`)  
**Production URL:** `https://dash.cr8w.com`  
**API Base:** `https://dash.cr8w.com/api/server/`

---

## 1. Canonical Source of Truth Registry

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

## 2. Hardcoded Config Architecture (`src/config/`)

To prevent drift and silent failures across Vercel Functions and client builds, all settings are centralized under `@/config/`:

1. **`notion.ts`**: Canonical database IDs, write policies (`MONEY` read-only), Notion workspace pages, and `assertNotionIdNotBlocked()` runtime assertions.
2. **`env.ts`**: Dual-sided environment variable accessors. Client uses `ENV` (via `import.meta.env`); server functions use `SERVER_ENV` with `assertRequired()`.
3. **`profiles.ts`**: Authoritative profiles definition for all 6 team members (`sunshine`, `monny`, `bingle`, `omar`, `pia`, `event-support`). Eliminates discrepancies in `AuthGate`, `LoginGate`, and `data.ts`.
4. **`routes.ts`**: Routing map linking paths (`/`, `/moves`, `/care`, `/flows`, `/money`, `/decisions`, `/system`, `/team`) to page components, required permissions, and primary Notion databases.
5. **`content.ts`**: Section titles, fallback quotes, glossary terms, event labels, and money stage mappings.
6. **`sync.ts`**: Sync order (`MOVES` → `PEOPLE` → `FLOWS` → `CONTENT` → `MONEY`), cache TTLs (`55s` in-memory, `60s` CDN), `assertWritable()` guard, and 15 canonical KV keys.

---

## 3. Bug Fixes Applied

- **FLOW_STATUS_MAP in `notionNormalizer.ts`:** Added `'idea'`, `'ready'`, and `'approved'` mapping to `'upcoming'`, and `'happened'` mapping to `'archived'`, preventing past gatherings from rendering as upcoming events.
- **MONEY Schema Normalization:** Updated `normalizeMoney()` to parse the live verified MONEY schema (`Stage`, `Kind`, `Direction`, `Expected`, `Actual`, `Doc`, `Person or Org`, `Owner`, `Flow`) alongside legacy aliases.
- **Seed Scripts Corrected:** 
  - `scripts/seed-username-map.mjs`: Updated KV table to `kv_store_dabe1c74`.
  - `scripts/seed-auth-user.mjs`: Corrected Supabase endpoint to `https://irtqcygriedvdijppntz.supabase.co`.
  - `scripts/seed-mb-admin.mjs`: Corrected Supabase endpoint to `https://irtqcygriedvdijppntz.supabase.co`.
- **Profile Consolidation:** Added `pia` to `LoginGate` and `event-support` to `PERSONS` in `data.ts`, fully powered by `src/config/profiles.ts`.
