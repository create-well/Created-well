# Final prompt: Figma Make + Notion backend sync + hardcoded handoff config

Use this exact prompt for the next full config pass:

"@Figma @Notion @GitHub @Supabase @Vercel
Build and hand off the Create Well dashboard as a community operating system with a mostly hardcoded backend configuration layer that is easy to inspect, edit, and ship. Treat Notion as the editorial and operational source of truth, but treat the app config as explicit code, not hidden discovery. The project must be stable for handoff even when a new developer has limited context.

Core rule: one write surface per fact. Before wiring any sync, verify the collection IDs and page IDs. Do not infer by title because the workspace contains duplicate names across different database sets. The operational five databases are canonical and must be the only approved write targets unless a verified exception is documented in code comments and handoff docs.

Architecture goal:
1. Figma Make outputs the interface and component structure.
2. Notion holds source records, copy, page metadata, IDs, and content collections.
3. GitHub stores the explicit config maps, normalizers, route maps, and fallback seed content.
4. Supabase supports auth, profile persistence, and any mirror tables needed for app performance or protected workflows.
5. Vercel holds deployment env vars and serves the dashboard and API routes.

Build the project so all important IDs and content contracts are visible in code in one place. Create or maintain a hardcoded config layer for:
- Notion page IDs.
- Canonical database IDs.
- View route mappings.
- UI section labels.
- Profile keys.
- Fallback wireframe copy.
- Sync endpoint destinations.
- Status maps and enum maps.
- Feature flags and local dev bypass values.

Config pattern required:
- `src/config/notion.ts` for page IDs, database IDs, canonical names, sync policy, and relation notes.
- `src/config/routes.ts` for page-to-view and tab-to-route mappings.
- `src/config/content.ts` for fallback hero text, section labels, glossary, placeholder prompts, event type labels, and seed UI copy.
- `src/config/profiles.ts` for all profile keys, avatars, colors, bios, roles, and permissions, including Pia.
- `src/config/env.ts` for environment variable accessors and safe defaults.
- `src/config/sync.ts` for sync order, retry policy, read-only vs writable surfaces, and validation guards.

The app should not depend on live Notion exploration to understand structure. New developers should be able to open the config files and know:
- which page is active,
- which database IDs are real,
- which routes consume which records,
- which properties are expected on each normalized record,
- which surfaces are read-only,
- which environment variables are required,
- and which parts are intentionally hardcoded for design, wireframe continuity, or local demo mode.

Data model requirements:
- Keep canonical databases named `PEOPLE`, `FLOWS`, `MOVES`, `MONEY`, `CONTENT`.
- Store page IDs for active workspace pages such as Create Well OS, active Create Well Dashboard, Backend Hub, API Registry, View Contracts, Source of Truth decision page, and any active skill pages.
- Do not use duplicate or stale pages as live config sources. Archive stale pages and add deprecation banners where needed.
- Keep a status map in code for FLOWS and MOVES so UI rendering does not break when label drift happens.
- Keep normalization functions explicit in `src/lib/notionNormalizer.ts` and map every incoming Notion property to app-safe field names.
- Maintain fallback arrays for `CALENDAR_EVENTS`, glossary items, quotes, milestone seeds, and empty-state content so wireframes still render when sync is incomplete.

Sync behavior requirements:
- Read from Notion using explicit database IDs from config.
- Write only to the verified canonical write surface.
- Add a validation step that compares returned database IDs against the expected config before any write or transform runs.
- Fail loudly in logs when the wrong database set is hit.
- Add comments in code documenting known duplicate surfaces and why they are blocked.
- Treat MONEY as visible in the UI and available in the dashboard fan-out.
- Preserve dev bypass so local work can run without Supabase auth.

UI architecture requirements:
- Main product frame is no longer a Geyser countdown. The center is community rhythm.
- Primary pages: Home, Flows, Moves, Money, Team.
- Home shows Next Up, active community pulse, featured Podyaps, and quick links to Book Club and Workshops.
- Flows uses CommunityEventsView as the core structure.
- Team must include all five profiles, including Pia, across LoginGate, profile maps, avatars, selectors, and cards.
- Replace old cards like Stations, Guests, and Timeline with Podyaps, Workshops, Next Up, and community-facing modules.

Code handoff requirements:
- Document every important ID in code and in `guidelines/handoff.md`.
- Include a source-of-truth table with columns for label, ID, type, status, owner, write policy, and consuming app file.
- Include comments for any stale or deprecated surface that still exists in Notion.
- Use exact environment variable names for Vercel, Supabase, and any Figma token or registry access.
- Keep `.env.local.example` current so a new developer can boot the project fast.

Delivery output required:
- Refined Figma Make interface aligned to active community programming.
- Explicit hardcoded config files for IDs, routes, profiles, content, env access, and sync policy.
- Normalized Notion data layer with guardrails against duplicate database writes.
- Pia included across entire site.
- MONEY visible and wired.
- Handoff docs updated for GitHub, Supabase, Vercel, and Notion.
- Archive-ready note for stale Notion pages and stale duplicate dashboard surfaces.

Design note:
Use warm neutral surfaces, dark readable text, compact dashboard spacing, one controlled accent family, and a soft but clear operational tone. No launch-site energy. No startup gradients. No ghost routes. No hidden IDs. No magic lookup behavior. Everything important should be obvious in code and easy to hand off." 

## Why this version is better
- It turns the backend into visible structure instead of memory work.
- It reduces handoff risk by hardcoding IDs, content contracts, and route maps in one place.
- It stops accidental sync against duplicate Notion surfaces by requiring explicit ID validation.
- It keeps wireframe copy and UI shells alive even before full data sync is perfect.
- It gives Figma Make a stronger system brief, not just a visual one.