# CR8W Create Well — Full Config & Optimization Plan
**Date:** 2026-09-21  
**Status:** Awaiting approval

---

## Context

The Create Well dashboard (dash.cr8w.com) is a Figma Make + React 18 + Vite + TypeScript + Tailwind v4 + Supabase + Notion project. The sandbox at `/workspaces/default/code` carries uncommitted changes (CommunityEventsView, Pia added, MONEY query activated, `normalizeMoney()`) that have not been pushed to `create-well/Created-well` main or deployed.

The core problem: **Notion database IDs, profile data, route maps, and sync policy live scattered across 6+ files with no single authoritative source.** This creates silent bugs (wrong DB set written to, duplicate pages, stale IDs), makes handoff hard, and blocks new developers from understanding what's wired and what isn't.

This plan creates a `src/config/` hardcoded layer, fixes known bugs, wires config into the existing API/normalizer, pushes the sandbox to GitHub, and updates Notion + handoff docs.

---

## Canonical IDs (verified from Notion API Registry, 2026-09-18)

### Hub CMS four — what `NOTION_DB_*` env vars MUST point to
These are the only approved write targets for the dashboard app:

| Env var | DB name | Database ID |
|---|---|---|
| `NOTION_DB_MOVES` | MOVES (hub) | `49faf1111bbe43458c3e6a4dcec63b5c` |
| `NOTION_DB_PEOPLE` | PEOPLE (hub) | `81fc482da44d43cb9c426952654944ab` |
| `NOTION_DB_CONTENT` | CONTENT (hub) | `08a0e011142a4512a3dc8075800db7db` |
| `NOTION_DB_FLOWS` | FLOWS (hub) | `8d9ebf0c04cb47219ca2e3942cee6212` |
| `NOTION_DB_MONEY` | MONEY (operational — read-only) | `acc5fe2fdeca4f8989e179e32ddbc24d` |

**Blocked IDs (operational five — edge function / sync scripts only, never dashboard writes):**
- PEOPLE: `ea53d1eddde243adb0344582cbeaf4c5`
- FLOWS: `17d69cdfab1f4bb78ba197ec0a829ff5`
- MOVES: `3da8c56469e948e489836ea8773d6354`
- CONTENT: `bffdc8056b984515935b9496524198f8`

### Notion page IDs
| Label | Page ID |
|---|---|
| Create Well OS | `9eea1136406942b389dffbaf66a64535` |
| Create Well OS — Master System | `7b4774c7e9ad4333841dd757a4b1c1df` |
| Create Well OS — Backend Hub | `3c324acf799d81f58671deedd964af1b` |
| SKILL: Dashboard Engineering | `f233b9d2bce943a1a11f95eec52d7292` |
| SKILL: Ops Triage | `fe425fadb1734a81a80c8bc409a66365` |
| CR8W — API ID Registry | `d540a31113ed4b5db64d534c5910f020` |
| Dashboard View Contracts | `ad57b157668e4dbfa4c3f48823c0fa24` |

### Infrastructure IDs
| Resource | ID |
|---|---|
| Supabase project | `irtqcygriedvdijppntz` |
| KV table (only live one) | `kv_store_dabe1c74` |
| Vercel project | `prj_6iGQ6SxXEWLiS8MuJrKBJZojyccG` |
| Vercel team | `team_6Uj3kwab3B7izR7CWXbUu49Q` |
| GitHub repo | `create-well/Created-well` (main) |
| Figma Make file | `H5p9jZz5h7VwzE0WzbBQ5G` |

---

## Known Bugs to Fix

### Bug 1 — FLOW_STATUS_MAP missing live statuses (HIGH)
**File:** `src/lib/notionNormalizer.ts`  
**Problem:** `FLOW_STATUS_MAP` has no entry for `Idea`, `Ready`, `Approved`, or `Happened`. Flows in these statuses fall through to the `'upcoming'` default, so past events render as upcoming.  
**Fix:** Add to the map:
```ts
'Idea': 'upcoming',
'Ready': 'upcoming', 
'Approved': 'upcoming',
'Happened': 'archived',
// existing: Scheduled/Planning/Confirmed → upcoming, Wrapped/Cancelled → archived
```
**Note:** The Notion skill page says this was "Fixed 2026-09-21" in the sandbox — verify actual file contents before applying; may already be present.

### Bug 2 — normalizeMoney() schema mismatch (MEDIUM)
**File:** `src/lib/notionNormalizer.ts`  
**Problem:** The verified MONEY schema uses `Stage` (not `Status`), `Kind` (not `Type`), `Expected`/`Actual` (not `Date`), and `Person or Org` (not `Closer`). The `normalizeMoney()` function added in the sandbox must be verified against these exact field names.  
**Verified MONEY fields:** `Name`, `Stage` (Possible/Committed/Invoiced/Received/Paid), `Kind` (Sponsorship/Ticket/Workshop Fee/Facilitator Pay/Venue/Production), `Direction` (In/Out), `Amount` (number), `Expected` (date), `Actual` (date), `Doc` (url), `Flow` (relation → FLOWS), `Owner` (relation → PEOPLE), `Person or Org` (relation → PEOPLE).

### Bug 3 — seed scripts reference dead KV table (LOW — may be fixed)
**Files:** `scripts/seed-username-map.mjs`, `scripts/seed-auth-user.mjs`, `scripts/seed-mb-admin.mjs`  
**Problem:** All three may still reference dead `kv_store_8dcd9693` and/or wrong Supabase project `axntibrdivccycxdwlzk`. The skill page says this was fixed 2026-09-21 in sandbox — verify actual file contents.  
**Fix:** Ensure all three use `kv_store_dabe1c74` and project `irtqcygriedvdijppntz`.

---

## Implementation Plan

### Phase 1 — Create `src/config/` (6 new files)

All imports from these files use the `@/config/` alias path.

#### `src/config/notion.ts`
Purpose: single write surface for all Notion IDs and write policy.
```ts
// Hub CMS four — the only approved write targets for the dashboard
export const NOTION_DB = {
  MOVES:   process.env.NOTION_DB_MOVES   ?? '49faf1111bbe43458c3e6a4dcec63b5c',
  PEOPLE:  process.env.NOTION_DB_PEOPLE  ?? '81fc482da44d43cb9c426952654944ab',
  CONTENT: process.env.NOTION_DB_CONTENT ?? '08a0e011142a4512a3dc8075800db7db',
  FLOWS:   process.env.NOTION_DB_FLOWS   ?? '8d9ebf0c04cb47219ca2e3942cee6212',
  MONEY:   process.env.NOTION_DB_MONEY   ?? 'acc5fe2fdeca4f8989e179e32ddbc24d',
} as const;

// Write policy — MONEY is read-only until Phase 2
export const NOTION_WRITE_POLICY = {
  MOVES:   'read-write',
  PEOPLE:  'read-write',
  CONTENT: 'read-write',
  FLOWS:   'read-write',
  MONEY:   'read-only', // Phase 2
} as const;

// Blocked IDs — operational five; never write these from the dashboard
export const NOTION_BLOCKED_IDS = {
  // These are the operational five under Backend Hub, used only by edge sync scripts.
  // If you see these in api/ code, it is a bug.
  MOVES_OPS:   '3da8c56469e948e489836ea8773d6354',
  PEOPLE_OPS:  'ea53d1eddde243adb0344582cbeaf4c5',
  FLOWS_OPS:   '17d69cdfab1f4bb78ba197ec0a829ff5',
  CONTENT_OPS: 'bffdc8056b984515935b9496524198f8',
} as const;

export const NOTION_PAGES = {
  OS:           '9eea1136406942b389dffbaf66a64535',
  MASTER:       '7b4774c7e9ad4333841dd757a4b1c1df',
  BACKEND_HUB:  '3c324acf799d81f58671deedd964af1b',
  API_REGISTRY: 'd540a31113ed4b5db64d534c5910f020',
  SKILL_ENGINEERING: 'f233b9d2bce943a1a11f95eec52d7292',
  SKILL_OPS_TRIAGE:  'fe425fadb1734a81a80c8bc409a66365',
} as const;

// Validation: call this at server startup to guard against wrong DB set
export function assertNotionIdNotBlocked(id: string, context: string): void {
  const blocked = Object.values(NOTION_BLOCKED_IDS);
  if (blocked.includes(id as any)) {
    throw new Error(`[notion] Blocked operational DB ID used in ${context}. Use hub CMS IDs only.`);
  }
}
```

#### `src/config/env.ts`
Purpose: typed accessors for all env vars with safe defaults and dev-bypass.
```ts
// Client-side (VITE_ prefix, safe to expose in bundle)
export const ENV = {
  DEV_BYPASS:    import.meta.env.VITE_DEV_BYPASS === 'true',
  SUPABASE_URL:  import.meta.env.VITE_SUPABASE_URL ?? '',
  SUPABASE_ANON: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  API_BASE:      import.meta.env.VITE_API_BASE ?? '',
} as const;

// Server-side (no VITE_ prefix, only available in api/ and supabase/functions/)
// Import this ONLY in api/ or server-only modules — never in src/app/
export const SERVER_ENV = {
  NOTION_SECRET:         () => process.env.NOTION_SECRET ?? '',
  SUPABASE_URL:          () => process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_KEY:  () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  // Required env vars — fail loudly if missing in production
  assertRequired(): void {
    const missing = ['NOTION_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY',
      'NOTION_DB_MOVES','NOTION_DB_PEOPLE','NOTION_DB_FLOWS','NOTION_DB_CONTENT','NOTION_DB_MONEY']
      .filter(k => !process.env[k]);
    if (missing.length > 0 && process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  },
} as const;
```

#### `src/config/profiles.ts`
Purpose: canonical source of truth for all team profiles. Replace scattered definitions in `AuthGate.tsx`, `LoginGate.tsx`, and `data.ts`.
```ts
export type ProfileKey = 'sunshine' | 'monny' | 'bingle' | 'omar' | 'pia' | 'event-support';
export type ProfilePermission = 'read' | 'write' | 'admin';

export interface Profile {
  key: ProfileKey;
  displayName: string;
  emoji: string;
  color: string;           // CSS custom property or hex token
  role: string;
  bio: string;
  email?: string;
  permission: ProfilePermission;
  hdType?: string;
  hdAuthority?: string;
}

export const PROFILES: Record<ProfileKey, Profile> = {
  sunshine: { key: 'sunshine', displayName: 'Sunshine', emoji: '☀️', color: '#C25B38', role: 'Co-Founder / Host', bio: '...', permission: 'admin', hdType: 'Projector', hdAuthority: 'Splenic' },
  monny:    { key: 'monny',    displayName: 'Monny',    emoji: '🌊', color: '#7BA89D', role: 'Co-Founder / Ops', bio: '...', permission: 'admin', hdType: 'Generator', hdAuthority: 'Sacral' },
  bingle:   { key: 'bingle',   displayName: 'Bingle',   emoji: '🌿', color: '#B8A9D4', role: 'Community',        bio: '...', permission: 'write', hdType: 'Manifesting Generator', hdAuthority: 'Sacral' },
  omar:     { key: 'omar',     displayName: 'Omar',     emoji: '🎤', color: '#2D2438', role: 'Content / Tech',   bio: '...', permission: 'write', hdType: 'Generator', hdAuthority: 'Sacral' },
  pia:      { key: 'pia',      displayName: 'Pia',      emoji: '🪷', color: '#B8A9D4', role: 'Support',          bio: '...', permission: 'write' },
  'event-support': { key: 'event-support', displayName: 'Event Support', emoji: '🎪', color: '#ececf0', role: 'Event Support', bio: '', permission: 'read' },
} as const;

export const PROFILES_LIST = Object.values(PROFILES);
export const ADMIN_EMAILS = new Set(['mb@tablante.com']);

// Dev-bypass defaults
export const DEV_DEFAULT_PROFILE: ProfileKey = 'monny';
```

#### `src/config/routes.ts`
Purpose: single place that defines what page renders at which path, what it's called in nav, and which Notion DB it primarily reads from.
```ts
import type { ProfileKey } from './profiles.js';

export interface RouteConfig {
  path: string;
  label: string;
  notionDb?: string;      // key into NOTION_DB
  requiredPermission: 'read' | 'write' | 'admin';
  featureFlag?: string;   // if set, feature must be enabled
}

export const ROUTES: RouteConfig[] = [
  { path: '/',          label: 'Home',      notionDb: 'FLOWS',   requiredPermission: 'read' },
  { path: '/flows',     label: 'Flows',     notionDb: 'FLOWS',   requiredPermission: 'read' },
  { path: '/moves',     label: 'Moves',     notionDb: 'MOVES',   requiredPermission: 'read' },
  { path: '/money',     label: 'Money',     notionDb: 'MONEY',   requiredPermission: 'write' },
  { path: '/care',      label: 'Care',                           requiredPermission: 'read' },
  { path: '/decisions', label: 'Decisions',                      requiredPermission: 'write' },
  { path: '/system',    label: 'System',                         requiredPermission: 'admin' },
] as const;

// Tab-to-route map for nav components
export const NAV_TABS = ROUTES.filter(r => !['/', '/system'].includes(r.path));
```

#### `src/config/content.ts`
Purpose: fallback UI copy, section labels, empty-state content, seed data. Keeps wireframes alive when data sync is incomplete.
```ts
export const SECTION_LABELS = {
  HOME_HERO:     'Welcome back to the well.',
  NEXT_UP:       'Next Up',
  COMMUNITY_PULSE: 'Community Pulse',
  FEATURED:      'Featured Podyaps',
  QUICK_LINKS:   'Quick Access',
  FLOWS_EMPTY:   'No upcoming flows. Check back soon.',
  MOVES_EMPTY:   'No open moves right now.',
  MONEY_EMPTY:   'No money records loaded yet.',
} as const;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  Podyap: 'Podyap',
  'Open Studio': 'Open Studio',
  'Book Club': 'Book Club',
  Workshop: 'Workshop',
  'Pop-Up': 'Pop-Up',
  'Surprise-ment': 'Surprise-ment',
  Geyser: 'Geyser',
  Internal: 'Internal',
};

export const MOVES_STATUS_LABELS: Record<string, string> = {
  Now: 'Now',
  Next: 'Next',
  Done: 'Done',
  Dropped: 'Dropped',
};

export const MONEY_STAGE_LABELS: Record<string, string> = {
  Possible: 'Possible',
  Committed: 'Committed',
  Invoiced: 'Invoiced',
  Received: 'Received',
  Paid: 'Paid',
};

export const FALLBACK_QUOTES = [
  'The well is always full.',
  'Water finds its level.',
  'Flow, don\'t force.',
] as const;

export const GLOSSARY: Record<string, string> = {
  Geyser: 'An unexpected eruption of creative energy or community event.',
  Podyap: 'A pop-up podcast or community conversation.',
  Depanty: 'The learning phase — what the water taught us.',
  'Co-h0e': 'Core team / co-holder of the well.',
  Titration: 'Careful, calibrated exposure — nothing too fast.',
  CoFlow: 'A shared creative session or accountability container.',
};
```

#### `src/config/sync.ts`
Purpose: sync order, retry policy, read-only guards, and validation rules for the Notion↔KV write bridge.
```ts
import { NOTION_DB, NOTION_WRITE_POLICY } from './notion.js';

// Order in which databases are fetched in api/dashboard.ts fan-out
export const SYNC_ORDER = ['MOVES', 'PEOPLE', 'FLOWS', 'CONTENT', 'MONEY'] as const;

export const SYNC_POLICY = {
  CACHE_TTL_MS:    55_000,  // in-process cache TTL (api/dashboard.ts)
  CDN_MAXAGE_S:    60,       // s-maxage for CDN
  FETCH_TIMEOUT_MS: 10_000, // client fetchDashboard timeout (api.ts)
  REQ_TIMEOUT_MS:   8_000,  // generic req() timeout (api.ts)
  RETRY_COUNT:      1,       // GET retry on network error
} as const;

// Validate incoming DB ID before any write or transform
export function assertWritable(dbKey: keyof typeof NOTION_DB, context: string): void {
  if (NOTION_WRITE_POLICY[dbKey] === 'read-only') {
    throw new Error(`[sync] ${dbKey} is read-only — write blocked in ${context}.`);
  }
}

export const KV_TABLE = 'kv_store_dabe1c74' as const;
// Dead table: kv_store_8dcd9693 — never use this. See SKILL: Dashboard Engineering.

export const KV_KEYS = {
  messages:          'cr8w_messages',
  braindumps:        'cr8w_braindumps',
  announcements:     'cr8w_announcements',
  forum_replies:     'cr8w_forum_replies',
  workshops:         'cr8w_workshops',
  workshop_programs: 'cr8w_workshop_programs',
  workshop_resources:'cr8w_workshop_resources',
  coflow_checkins:   'cr8w_coflow_checkins',
  well_notes:        'cr8w_well_notes',
  calendar_events:   'cr8w_calendar_events',
  invite_counts:     'cr8w_invite_counts',
  parking_lot:       'cr8w_parking_lot',
} as const;
```

---

### Phase 2 — Bug Fixes

#### Fix A — `src/lib/notionNormalizer.ts`: FLOW_STATUS_MAP
Read the file first. If these keys are missing, add them to `FLOW_STATUS_MAP`:
```ts
'Idea':      'upcoming',
'Ready':     'upcoming',
'Approved':  'upcoming',
'Happened':  'archived',
```

#### Fix B — `src/lib/notionNormalizer.ts`: normalizeMoney() field names
Verify `normalizeMoney()` uses:
- `Stage` (not `Status`) for the stage select
- `Kind` (not `Type`) for the kind select
- `Expected` and `Actual` (not `Date`) for the two date fields
- `Person or Org` (not `Closer`) for the relation

#### Fix C — `scripts/` seed files: KV table and project ID
Verify and correct if needed:
- `seed-username-map.mjs`: `const KV_TABLE = 'kv_store_dabe1c74'`
- `seed-auth-user.mjs`: project = `irtqcygriedvdijppntz`
- `seed-mb-admin.mjs`: project = `irtqcygriedvdijppntz`

---

### Phase 3 — Wire Config into Existing Code

#### `api/dashboard.ts`
Replace bare `process.env.NOTION_DB_*` references with `NOTION_DB.*` from `../src/config/notion.js` (use `.js` suffix per Vercel ESM rules). Add `assertNotionIdNotBlocked()` call in the fan-out before any Notion query. Replace hardcoded `'kv_store_dabe1c74'` with `KV_TABLE` from `../src/config/sync.js`.

#### `api/notionWriter.ts` (currently `api/_notionWriter.ts` in production naming)
Replace `process.env.NOTION_DB_*` lookups with `NOTION_DB.*` from config. Add `assertWritable()` guard before any `notionCreate` or `notionUpdate` call. Keep the `_` prefix so Vercel doesn't expose it as a route.

#### `src/app/components/data.ts`
Replace `PERSONS` array definition with an import from `@/config/profiles.ts`. Keep the `HD_PROFILES`, `MBODY_PRACTICES`, `GLOSSARY`, `QUOTES` etc. that are still in `data.ts` — or move `GLOSSARY` to `content.ts` and import it back. The goal is that `PERSONS` in `data.ts` derives from `PROFILES_LIST` so profile additions only happen in one place.

#### `src/app/components/AuthGate.tsx`
Replace the inline `PROFILES` array with `import { PROFILES_LIST } from '@/config/profiles'`. Replace the `ADMIN_EMAILS` set with `import { ADMIN_EMAILS } from '@/config/profiles'`.

#### `src/app/components/LoginGate.tsx`
Same — replace inline `PROFILES` with import from config.

#### `src/app/routes.ts`
Optionally add a `Team` route (`/team`) once the Team page component exists. For now, document its intended path in `ROUTES` from `routes.ts` with a `featureFlag: 'team_page'` to keep it out of nav.

---

### Phase 4 — Documentation

#### `.env.local.example`
Expand to include all required server-side vars:
```
# Dev bypass (skips Supabase auth, loads monny profile)
VITE_DEV_BYPASS=true

# Client Supabase (optional — only needed for production auth testing)
# VITE_SUPABASE_URL=https://irtqcygriedvdijppntz.supabase.co
# VITE_SUPABASE_ANON_KEY=<public anon key>

# API base override (for local edge function testing)
# VITE_API_BASE=http://localhost:54321/functions/v1/make-server-dabe1c74

# Server-side (Vercel env vars — also needed for local `vercel dev`)
# NOTION_SECRET=<notion integration token>
# NOTION_DB_MOVES=49faf1111bbe43458c3e6a4dcec63b5c
# NOTION_DB_PEOPLE=81fc482da44d43cb9c426952654944ab
# NOTION_DB_FLOWS=8d9ebf0c04cb47219ca2e3942cee6212
# NOTION_DB_CONTENT=08a0e011142a4512a3dc8075800db7db
# NOTION_DB_MONEY=acc5fe2fdeca4f8989e179e32ddbc24d
# SUPABASE_URL=https://irtqcygriedvdijppntz.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Figma kit registry (Vercel only — rotates with each new sandbox session)
# FIGMA_REGISTRY_TOKEN=figi_EzhrPi1OmRGvcgU35iPRYwDs3ihS2N-CWAoZoq57
```

#### `guidelines/handoff.md`
Add a **Source of Truth** table:

| Label | ID / Value | Type | Status | Owner | Write Policy | Consuming file |
|---|---|---|---|---|---|---|
| MOVES (hub) | `49faf1111bbe43458c3e6a4dcec63b5c` | Notion DB | Active | Monny | read-write | `src/config/notion.ts`, `api/dashboard.ts` |
| FLOWS (hub) | `8d9ebf0c04cb47219ca2e3942cee6212` | Notion DB | Active | Monny | read-write | `src/config/notion.ts` |
| MONEY (operational) | `acc5fe2fdeca4f8989e179e32ddbc24d` | Notion DB | Active | Monny | read-only | `src/config/notion.ts` |
| KV table | `kv_store_dabe1c74` | Supabase KV | Active | Omar | read-write | `src/config/sync.ts` |
| Dead KV | `kv_store_8dcd9693` | Supabase KV | Blocked | — | blocked | See SKILL: Engineering |

Add deprecation note for any stale pages found.

---

### Phase 5 — GitHub Push

Files to commit (all sandbox changes + new config layer + bug fixes):
- `src/config/notion.ts` (new)
- `src/config/routes.ts` (new)
- `src/config/content.ts` (new)
- `src/config/profiles.ts` (new)
- `src/config/env.ts` (new)
- `src/config/sync.ts` (new)
- `src/lib/notionNormalizer.ts` (FLOW_STATUS_MAP fix, normalizeMoney verification)
- `src/app/components/CommunityEventsView.tsx` (sandbox — new)
- `src/app/components/data.ts` (Pia added, derive from profiles config)
- `src/app/components/AuthGate.tsx` (import from profiles config)
- `src/app/components/LoginGate.tsx` (import from profiles config)
- `api/dashboard.ts` (MONEY query, use config IDs)
- `api/notionWriter.ts` (use config IDs)
- `scripts/seed-username-map.mjs` (KV table fix if not done)
- `scripts/seed-auth-user.mjs` (project ID fix if not done)
- `scripts/seed-mb-admin.mjs` (project ID fix if not done)
- `.env.local.example` (expanded)
- `guidelines/handoff.md` (source-of-truth table + updated status)

**Commit message:**
```
feat: hardcoded config layer + FLOW_STATUS_MAP fix + MONEY normalizer

- src/config/: notion.ts, routes.ts, content.ts, profiles.ts, env.ts, sync.ts
- All Notion IDs and KV key names now centralized in config
- FLOW_STATUS_MAP: add Idea/Ready/Approved/Happened coverage
- normalizeMoney(): verified against live MONEY schema (Stage/Kind/Direction)
- CommunityEventsView on /flows replaces expired Geyser countdown
- Pia included across all team-listing surfaces
- MONEY read query active in api/dashboard.ts
- Seed scripts: KV table and Supabase project ID corrected
- .env.local.example: expanded with all server-side vars + default IDs
- guidelines/handoff.md: source-of-truth table added
```

---

### Phase 6 — Notion Updates (post-push)

After the GitHub push is confirmed, update `SKILL: Dashboard Engineering` (page `f233b9d2bce943a1a11f95eec52d7292`) to add a **Config layer** section describing the 6 files, their purpose, and import pattern. Mark the "Shipped in sandbox — pending push" section as shipped.

---

## Verification

1. **Local dev smoke test:** `VITE_DEV_BYPASS=true npm run dev` → app loads, no console errors, all 6 profiles visible in LoginGate.
2. **FLOW_STATUS_MAP:** Open the `/flows` route — past events should not appear as upcoming. Query FLOWS DB directly and verify `Happened`/`Idea` records route correctly.
3. **normalizeMoney():** Open `/money` — money records render without type errors; check `Stage` field populates.
4. **Config import guard:** Add a temporary `console.log(NOTION_DB)` in `api/dashboard.ts`, run `vercel dev`, confirm IDs match the hub CMS four.
5. **Blocked ID guard:** Call `assertNotionIdNotBlocked(NOTION_BLOCKED_IDS.MOVES_OPS, 'test')` in a test — should throw.
6. **GitHub:** `git log --oneline -5` on main shows the new commit; Vercel auto-deploy triggers.
7. **Production:** `https://dash.cr8w.com` loads; `/flows` shows CommunityEventsView; all 6 profiles available in LoginGate.
8. **Seed scripts:** Run `node scripts/seed-username-map.mjs` against the staging Supabase — no errors, writes to `kv_store_dabe1c74`.

---

## Out of scope for this pass

- Building new pages (Team page, `/team` route) — config stubs exist but no component work
- Google Calendar OAuth redirect URI update — requires GCP console access, tracked in MOVES
- `@cr8w/design-system` v0.0.3 publish — tracked in MOVES, requires FIGMA_REGISTRY_TOKEN rotation in Vercel
- MONEY write bridge (Phase 2) — config and schema verified; wire-up deferred
- View contracts in Notion (`vw_moves_active` etc.) — listed in SKILL: Dashboard Engineering as SPEC, not built
- Slack connection for Flowing Well agent — deferred per §7 of Full Instructions
