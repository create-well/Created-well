# Flow navigation linked-dropdown design

- **Date:** 2026-10-26
- **Status:** Option 1 direction approved by the user; written spec pending user review; application code unchanged.
- **Owner:** Monny (accountable); one implementation owner on this branch.
- **Target:** Internal dashboard repository `create-well/Created-well`.
- **Base:** `0025582034e8dce151ca834543812b464e56e01b` (`feature/canva-dashboard-v2`).
- **Candidate branch/worktree:** `feature/flow-nav-linked-dropdown` at `/Users/monicablanco/Documents/Manus/2026-10-26/20HAPg/.work/Created-well-flow-nav`.

## 1. Context and problem

The route tree already contains `/flows`, `/podyaps`, and `/workshops`. `/flows` renders the general `CommunityEventsView`; `/podyaps` owns the Podyap-specific page and preflight; `/workshops` renders the workshop-filtered event view. The home cards and in-page cross-links already reach these routes. The shared `TopNav` primary list currently exposes This Week, Moves, Care, Money, Decisions, and System, so the three related Flow destinations are not discoverable from the primary navigation.

The Web/CMS Workbench draft was reviewed separately. Its proposed text is release-control and coordination guidance: it points internal delivery to Engineering OS, requires exact-action approval, preserves independent review, and keeps public CMS readiness separate. It does not specify a site map or UI behavior, and it is not part of this repo change.

## 2. Goal and non-goals

**Goal:** Add one compact, predictable primary-navigation entry for the Flow area while keeping `/flows` a one-click destination and making `/podyaps` and `/workshops` available as its siblings.

**Non-goals:** No route renames/removals, home-page redesign, data/API changes, source-binding changes, auth or permission changes, Notion mutations, public-site/CMS work, merge, deployment, or publication. Existing home cards and in-page links remain unchanged.

## 3. User-approved direction and interaction design

The user approved navigation simplification only and explicitly requested **Option 1 (Linked dropdown)**. This written spec makes that direction concrete; application implementation remains gated on the user's review of this document.

- Place **Flows** after **Care** and before **Money**, matching the existing grouping of daily/Well work without moving other navigation items.
- The visible **Flows** text is a normal link to `/flows`. It remains a direct one-click path and receives the active link treatment on `/flows`.
- Put a separate chevron disclosure button beside that link. It toggles a small popover containing only **Podyaps** (`/podyaps`) and **Workshops** (`/workshops`); do not duplicate the `/flows` overview in the popover.
- Mark the Flow group as active on `/flows`, `/podyaps`, and `/workshops`, while retaining the route-specific selected state on each destination. Apply `aria-current="page"` to the link whose destination matches the current route, including the selected child link; do not mark the `/flows` link current on a child route.
- Desktop disclosure opens on click/tap and native keyboard activation. Use normal links rather than ARIA `menu` roles so Tab navigation remains conventional. Expose the disclosure with an action-specific accessible name (for example, “Show Flow destinations” / “Hide Flow destinations”), `aria-expanded`, and `aria-controls`. Give desktop and mobile disclosure panels distinct, unique IDs; each `aria-controls` must point to a present panel, and `aria-expanded` must match actual visibility. Give both chevron controls a minimum 40×40 CSS-pixel hit target. Escape closes the popover and returns focus to its trigger; clicking outside or choosing a child route closes it. A route change also closes it.
- The mobile drawer uses the same labels and destinations: a direct **Flows** link plus a separate expand/collapse control. Children are indented beneath the group. Give the hamburger an action-specific accessible name, `aria-expanded`, and `aria-controls` pointing to the unique drawer panel. Treat the open overlay as a modal navigation drawer: move focus to its first navigation link when opened, keep Tab/Shift+Tab within the open drawer, and return focus to the hamburger when Escape closes it. Clicking the backdrop or choosing a route closes the drawer; Escape closes it even if the Flow child disclosure is expanded. If the drawer opens while the current route is `/podyaps` or `/workshops`, the group starts expanded; the user may still collapse it.
- Allow the mobile drawer to scroll internally when its content exceeds the available viewport height, including short screens and zoomed layouts. Respect reduced-motion settings and existing focus-visible conventions. Neither disclosure depends on hover.
- Keep the desktop popover within the viewport: align or flip it when it approaches an edge, cap its height to available viewport space, and allow internal scrolling when constrained.

## 4. Code boundary

Expected application files:

1. `src/app/components/TopNav.tsx` — add shared Flow child-route metadata and render a separate direct link/disclosure pair in desktop and mobile navigation; manage open state, active-group state, Escape/outside-click, drawer focus, and route-change closing.
2. `src/app/cr8w.css` — add scoped desktop popover and mobile nested-disclosure/drawer scrolling styles, including focus-visible and active states; avoid changing unrelated nav styles.

`src/app/routes.ts`, `ThisWeekPage.tsx`, `FlowsPage.tsx`, `PodyapsPage.tsx`, and `WorkshopsPage.tsx` are read-only dependencies and should not change. If implementation discovers a need to alter route/page/data behavior, stop and return for a revised design rather than expanding scope.

## 5. Implementation steps

1. Re-check the clean isolated worktree and exact base; retain the original worktree's untracked `.cursor/` and `supabase/.temp/` files untouched.
2. Add the Flow group to shared desktop/mobile navigation without replacing the existing six entries or home-card routes.
3. Implement the direct `/flows` link and separate sibling disclosure, with active-route highlighting and deterministic open/close behavior.
4. Add the same accessible disclosure structure to the mobile drawer, including hamburger state, focus containment/return, Escape/backdrop close, and constrained-height scrolling; preserve close-on-navigation behavior.
5. Add narrowly scoped desktop/mobile CSS for placement, stacking, responsive sizing, viewport collision handling, focus, active states, drawer scrolling, and reduced motion.
6. Run `git diff --check` and `npm run build`; there is no dedicated test/lint script in `package.json`. The production build does not deploy. Perform focused synthetic UI checks for desktop pointer/keyboard open, child navigation, Escape/outside close, active group versus route-specific child state and `aria-current` on all three routes, unique `aria-controls` targets and synchronized `aria-expanded`, focus returning to the trigger after Escape, 40×40 CSS-pixel disclosure hit targets on desktop and mobile, popover alignment/flip and constrained-height scrolling, mobile drawer focus entry/containment/Escape return/backdrop and route close, and short-viewport scrolling. Record viewport dimensions, tested route/setup, and observed results; if a local browser or synthetic route harness is unavailable, record that limit instead of implying it passed.
7. Ask for independent read-only review of the exact changed files and focused results. Do not merge, push, deploy, or publish.

## 6. Acceptance criteria

- The six existing primary destinations remain present and in their current order; a single **Flows** entry appears between Care and Money.
- Clicking **Flows** navigates directly to `/flows`; the adjacent disclosure exposes exactly Podyaps and Workshops, and both links preserve their existing paths.
- Flow grouping is visibly active on all three routes; the active child route remains distinguishable visually and with `aria-current="page"` on the matching route link.
- Desktop disclosure has an action-specific accessible name, unique `aria-controls`, and `aria-expanded` synchronized with visibility. Both chevron targets are at least 40×40 CSS pixels. Keyboard-only users can operate them; Escape closes and restores trigger focus; outside click and route changes close them.
- The mobile hamburger exposes its accessible name/state and controls the unique drawer panel. The open drawer receives focus, contains keyboard navigation, closes on Escape/backdrop/route selection, and restores focus to the hamburger on Escape. The drawer scrolls when the viewport is too short for its contents.
- The desktop popover aligns/flips to remain within the viewport, has a constrained maximum height with internal scrolling, and is not clipped near viewport edges. Mobile child links remain usable at narrow widths and zoom levels.
- No route, home-card, page content, data/API, source binding, authorization, or public CMS behavior changes.
- Evidence is reported separately as source review, pure/static checks, synthetic UI checks, and any runtime check actually performed. No synthetic result is described as authenticated or live-provider verification.

## 7. Verification and rollback

Focused checks planned: `git diff --check`, `npm run build`, plus the bounded synthetic UI checks above. A successful `npm run build` verifies only that the production bundle compiles; it does not deploy or prove live-provider or authenticated behavior. No dedicated unit/integration test runner is declared in `package.json`.

Rollback for a later code implementation is limited to reverting the candidate's `TopNav.tsx` and `cr8w.css` changes on `feature/flow-nav-linked-dropdown`; leave unrelated files and the original worktree untouched. If the written spec is declined before implementation, remove only this candidate branch/worktree and its spec. No merge/deployment rollback is needed because neither is authorized or planned.