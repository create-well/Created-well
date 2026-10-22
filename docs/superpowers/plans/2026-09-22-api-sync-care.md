# API Boundary, Sync UX, and Care Registry Implementation Plan

> **For agentic workers:** Execute inline in this session with the current repository architecture.

**Goal:** Port the migration branch’s highest-value ideas onto current `main` without replacing existing routes or dashboard surfaces.

**Architecture:** Add server-only configuration modules for the KV table and Notion database mappings; make `api/dashboard.ts` and `api/server.ts` consume them while preserving endpoint behavior. Add an explicit retry nonce and sync error metadata to `DashboardContext`, then expose a retry-aware status bar. Add a read-only People & Pathways registry to the existing Care page using current dashboard stations as its initial data source.

**Tech Stack:** React, TypeScript, Vite, Vercel serverless handlers, Supabase KV, Node test runner.

**Spec:** `/home/ubuntu/created-well-migration-review.md`

## Global Constraints

- Do not use or store the PAT pasted into chat; no credential changes are part of this implementation.
- Do not change GitHub permissions, Supabase schema, or external connections.
- Preserve `/podyaps`, `/workshops`, `/money`, `/decisions`, and current API routes.
- Keep server-only environment access out of the browser bundle.
- People & Pathways is a read-only prototype; no new writes or database migrations.

---

### Task 1: Central configuration boundary

**Files:**
- Create: `src/config/env.ts`, `src/config/notion.ts`, `src/config/sync.ts`, `src/config/index.ts`
- Modify: `api/server.ts`, `api/dashboard.ts`, `api/notionWriter.ts`
- Test: `tests/current-architecture.test.mjs`

- [ ] Define server-safe getters and canonical `KV_TABLE` / `NOTION_DB` mappings.
- [ ] Replace duplicated KV and Notion mappings in API modules.
- [ ] Assert the API topology and canonical identifiers.
- [ ] Run `npm test` and `npm run check`.

### Task 2: Sync freshness and retry UX

**Files:**
- Modify: `src/contexts/DashboardContext.tsx`, `src/types/dashboard.ts`, `src/app/components/SyncStatusBar.tsx`
- Test: `tests/sync-status.test.mjs`

- [ ] Add `syncError`, `retryNonce`, and a public `retrySync` action.
- [ ] Make retry reset backoff and recreate the polling effect.
- [ ] Display stale/failed state with a retry button and accessible status text.
- [ ] Verify first-load failure, retry recovery, and normal fresh state.

### Task 3: Read-only People & Pathways prototype

**Files:**
- Create: `src/app/components/CarePeopleRegistry.tsx`
- Modify: `src/app/pages/CarePage.tsx`
- Test: `tests/care-people-registry.test.mjs`

- [ ] Map current `Station[]` records to a display-only pathway model.
- [ ] Render invitation prompt, stage/status, owner, and sync provenance.
- [ ] Preserve current CoFlow care UI and consent gating.
- [ ] Add structural tests for the prototype.

### Task 4: Verification and commits

- [ ] Run `npm test`, `npm run check`, `npm run build`, and `git diff --check`.
- [ ] Review the staged diff for secrets, route deletions, and unrelated migration changes.
- [ ] Commit each logical slice with conventional commit messages.
- [ ] Leave the branch ready for a secure push after PAT rotation.
