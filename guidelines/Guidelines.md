# Create Well (CR8W) — Development & Contribution Guidelines

Welcome to the **Created-well** repository. This document outlines the engineering principles, architectural patterns, design standards, and contribution workflows for developers and AI agents working on the Create Well platform (`cr8w.com` and `dash.cr8w.com`).

---

## 1. System Overview & Tech Stack

- **Frontend SPA:** Vite + React 18 + TypeScript + React Router v7.
- **Styling & UI:** Tailwind CSS v4, Radix UI primitives, Lucide React icons, and tokenized custom theme (`default_shadcn_theme.css`, `cr8w.css`).
- **Telemetry:** `@vercel/speed-insights`.
- **Backend & Functions:** Vercel Node Serverless Functions (`/api/`) running under Node ESM.
- **Data Layer:** 
  - **Supabase:** Primary fast operational data store (`kv_store_dabe1c74`), real-time sync, and user authentication.
  - **Notion REST API:** Content management system of record for 4 core operational databases:
    - `MOVES` → Tasks
    - `PEOPLE` → Stations & Directory
    - `CONTENT` → Forum Posts & Stories
    - `FLOWS` → CoFlow Gatherings & Events

---

## 2. Frontend & Component Engineering Guidelines

### Token-Based Theming & Styling
- **Design Tokens:** Always utilize tokenized utility classes and semantic CSS variables for colors, typography, border radius, and spacing. Never introduce arbitrary hardcoded hex codes or pixel dimensions unless strictly required for third-party widget embeds.
- **Color Palette:** Warm earth tones (`#C25B38` terracotta, warm neutrals, sage, dark slate). Components must support dark/light theme switching via `next-themes` and `ThemeProvider`.
- **Iconography:** Use `lucide-react` icons uniformly. Keep icon sizing consistent (`w-4 h-4` for compact buttons, `w-5 h-5` for standard navigation items).

### Responsive & Accessible Layouts
- **Mobile-First:** Layouts must render cleanly on mobile viewports (375px–430px) before scaling up to tablet (`md:`) and desktop (`lg:`) views.
- **Semantic Structure:** Use appropriate HTML landmark elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`).
- **Accessibility (a11y):**
  - Ensure interactive elements are keyboard navigable (`tabIndex`, `onKeyDown`).
  - Provide descriptive `aria-label` attributes on icon-only buttons and modal dialogs.
  - Maintain WCAG AA contrast ratios across all text elements on background colors.

### State & Performance
- **Local vs. Global State:** Encapsulate component-specific state with `useState` and `useReducer`. Access synced workspace state via `useDashboard()` from `DashboardContext`.
- **Memoization:** Leverage `useMemo` and `useCallback` on heavy data transformations (e.g., filtering large message histories or calendar schedules).

---

## 3. Backend & API Rules (Vercel Serverless & Node ESM)

These rules are critical to preventing production downtime under Vercel's Node runtime.

### Mandatory `.js` Extensions on Relative Imports
- Under Node ESM, TypeScript relative imports in `api/` and shared files reachable by `api/` (such as `src/lib/notionNormalizer.ts`) **MUST** explicitly end with `.js` (e.g., `import { ... } from './_notionWriter.js'`).
- Omitting `.js` results in `ERR_MODULE_NOT_FOUND` at serverless runtime.
- Pure type-only imports (`import type { ... } from '...'`) do not emit runtime code and are safe, but preserving `.js` across shared modules is strongly encouraged.

### Route Governance & Private Modules
- **Route Delegation:** Route `/api/server/*` traffic through the single catch-all handler `api/server/[[...path]].ts`, which delegates to `api/_server.ts`.
- **Private Prefixes:** Any shared logic or helper files in `api/` must begin with an underscore (e.g., `_server.ts`, `_notionWriter.ts`). Vercel ignores `_` files and will not deploy them as separate endpoints.
- **Collision Avoidance:** Never create both `api/x.ts` and `api/x/` directory handlers, as Vercel routing resolves them unpredictably.

### Dual-Write Pattern
- **Fast Path:** Write immediately to the Supabase KV store (`kv_store_dabe1c74`) to guarantee responsive UI feedback.
- **CMS Sync:** Dual-write asynchronously to Notion for the 4 supported types. Notion operations are best-effort: failure to write to Notion must log a warning but never block or fail the primary KV write.

---

## 4. Voice, Copywriting & Cultural Integrity

Create Well builds invitations for artists, cultural practitioners, and creatives to return to sustainable creative wellness. When generating copy, documentation, or interface labels, follow these standards:

- **Flow:** Move in the sequence: **Sensation → Story → Strategy**.
- **Tone:** Grounded, warm, conversational, and direct. Avoid corporate jargon (banned words: *tapestry, landscape, pivotal, foster, underscore, interplay, intricate, enhance, embark, beacon, multifaceted, myriad*).
- **Wellness Boundaries:** Somatic and nervous system language should encourage gentle observation (breath, posture, pauses) without making diagnostic or medical claims.

---

## 5. Git & PR Workflow

1. **Branching:** Work in dedicated feature branches (e.g. `feature/name`, `copilot/*`).
2. **Review & Test:** Validate API changes against Vercel preview deployment URLs rather than production (`cr8w.com`).
3. **Commit Granularity:** One conceptual change per PR. Avoid bundling dependency upgrades, feature logic, and refactors into a single PR.\n4. **Pull Requests:** Provide clear descriptions citing modified files, expected behavior, and verified status codes for all touched endpoints.
