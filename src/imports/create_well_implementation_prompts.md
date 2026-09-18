# Create Well Dashboard — Implementation Prompts for Figma Make

Paste each prompt into the Figma Make AI chat **in order**. Wait for each to complete before moving to the next.

---

## Phase 1: Design Foundation — Color & Typography

**Copy everything below the line and paste into Figma Make:**

---

Refactor the entire CSS design system in style.css with the following changes:

**Color Palette — replace all current colors:**
- Background base: #F5F0EB (warm sand)
- Surface/card: #FFFFFF
- Surface secondary: #EDE8E3 (warm gray)
- Text primary: #2D2A26 (dark warm brown, NOT pure black)
- Text secondary: #7A756E (muted brown)
- Text tertiary: #A39E97 (light muted)
- Border/divider: #E0DBD5 (soft warm line)
- Accent Sunshine: #E8A44A (warm amber)
- Accent Monny: #7B9E6B (sage green)
- Accent Bingle: #8B7EC8 (soft purple)
- Interactive/CTA: #5B8A72 (forest sage)
- Success: #7B9E6B
- Warning: #D4A04A
- Danger: #C47171
- Hover states: 8% darker version of the element's color

**Typography — simplify to one family:**
- Font family: 'Inter', system-ui, sans-serif throughout
- Remove ALL all-caps text transforms (especially headers like "PROJECTOR 2/4 · EGO AUTHORITY")
- Page title: 24px, font-weight 600
- Section headers: 14px, font-weight 600, text-transform: none
- Body text: 14px, font-weight 400
- Small/meta text: 12px, font-weight 400, use text-secondary color
- Spark labels and tags: 11px, font-weight 500

**Spacing & Whitespace:**
- Card padding: 20px (up from current)
- Gap between cards/sections: 16px
- Section margin-bottom: 24px
- Remove any section that has less than 8px breathing room from its neighbor

Apply these globally. Every component should inherit from these tokens. Do NOT change any functionality or JS logic — only CSS and any inline style overrides in JSX.

---

## Phase 2: Rebuild the Hub as a 'Right Now' View

**Copy everything below the line and paste into Figma Make:**

---

Redesign the Hub page with these structural changes:

**Remove from Hub entirely:**
- Rotating quotes section
- Notion sync bar (move to a settings/admin page if needed)
- The full Geyser Command Center widget (it gets its own page already)
- The collective member cards grid (replace with just 3 small avatar circles that link to each person's dashboard)

**Keep but redesign:**
- BHD Meeting banner → convert to a single subtle line: "[date] · BHD Meeting · [time]" with a small calendar icon, no large banner
- Quick links (Gmail, Calendar, Drive, Shared Drive) → collapse into a single "🔗 Tools" button that expands a small dropdown on click
- Launch countdown → keep but make it the visual centerpiece: large number, small label, no extra text
- Shared Brain Dump → keep but limit visible entries to 3 most recent, with "see all" link
- MBody Roulette shortcut → move to Playground only

**New Hub layout (top to bottom, single column, centered, max-width 480px):**
1. Date + time of day greeting ("Good morning" / "Good afternoon" / "Good evening") — one line
2. Launch countdown — large centered number with label
3. Next meeting — single line with icon
4. Brain dump — compact, 3 items max visible
5. 3 avatar circles linking to person dashboards
6. Collapsed "🔗 Tools" button at bottom

The Hub should feel like a calm home screen, not a command center. Max scroll: 1 screen height on mobile.

---

## Phase 3: Person Dashboards — 5 Tabs → 3 Modes

**Copy everything below the line and paste into Figma Make:**

---

Restructure each person's dashboard (Sunshine, Monny, Bingle) from 5 tabs to 3 tabs:

**New tab structure:**
1. **Flow** (replaces Overview) — the default landing tab
2. **Work** (combines Calendar + Action Items)
3. **Depth** (combines HD Profile + The Well)

**Flow tab content (top to bottom):**
- Person name + HD type as ONE subtle line: "Bingle · Projector 2/4 · Ego Authority" in 12px text-secondary, no all-caps, no bold
- Today's date, one line
- Check-in prompt — keep the input but shorten label to just the question, no emoji prefix
- HD Flow reminder — REPLACE the entire multi-paragraph block with ONE sentence max. Example: "Wait for the invitation. Your energy is precious — spend it where it's seen." Remove the "Invitation Check:" label and "Energy Budget:" section entirely from here
- Due Soon count + Clarity Queue count — side by side in a single row, compact
- Distilled Insights / Sparks — keep the capture input, show max 3 recent sparks
- Coming Up — show only next 2 events, not 5. Add "see all" that goes to Work tab

**Work tab content:**
- Google Calendar embed (full width)
- Mini calendar + upcoming events list (from old Calendar tab)
- Action Items list with filters (from old Action Items tab)
- Due Soon items highlighted at top

**Depth tab content:**
- HD Profile accordion (from old HD Profile tab) — but collapse ALL sections by default, user must tap to expand
- The Well content (titration funnel, milestones, glossary, forum)
- Keep glossary and forum but nest under expandable headers

**Remove from person dashboards:**
- The external links row (Gmail, Calendar, Drive, Shared Drive) — these live on Hub now
- The "Energy Budget" multi-paragraph section (the one-liner in Flow replaces it)
- The "PROJECTOR 2/4 · EGO AUTHORITY · EXTERNAL EXPRESSION / DISTILLER" all-caps block — that info is now in the subtle subtitle line
- The donut chart placeholder when there are no tasks (showing "No tasks yet" with a chart icon is a dead end — replace with: "No tasks yet — check your Work tab")

---

## Phase 4: Anti-Paralysis Patterns & Empty States

**Copy everything below the line and paste into Figma Make:**

---

Update all empty states and interaction patterns:

**Empty states — replace all "No X yet" messages with invitations:**
- "No tasks yet" → "Nothing queued — what's one thing you could move forward?"
- "No clarity items yet ✨" → "Quiet queue — space for what's next"
- "No sparks yet" → "Capture a spark below ✨" (keep the input right there)
- "📊 No tasks yet" (donut chart) → remove the chart icon entirely, just show the invitation text

**Smart defaults:**
- Coming Up section: only show events within next 48 hours by default. Add a "show more" toggle to see further out
- Action Items: pre-filter to "In Progress" or "Not Started" — don't show completed by default
- If a person has 0 due soon items, show: "All clear for now 🌿" instead of "0 items" with a label

**Micro-interactions (CSS transitions):**
- All expandable sections: add transition: max-height 0.25s ease, opacity 0.2s ease
- Card hover: subtle translateY(-1px) with box-shadow increase, transition 0.15s ease
- Tab switching: add a fade transition (opacity 0 → 1, 0.15s) when switching between Flow/Work/Depth
- The Spark ✨ button: on hover, scale(1.02) with background color shift to the person's accent color
- Collapse/expand icons: rotate 90deg smoothly when toggling

**Progressive disclosure:**
- Any section with more than 3 items: show 3, then "Show more" link
- HD Profile accordion: all closed by default with chevron icons
- Brain dump on Hub: 3 visible, expandable

---

## Phase 5: Playground → Depth Mode Integration

**Copy everything below the line and paste into Figma Make:**

---

Remove Playground as a top-level navigation item. Redistribute its contents:

**HD Type Finder calculator** → Move into each person's Depth tab, at the top, as a collapsible section: "🔍 HD Type Finder" — collapsed by default

**Collective Synergy analysis** → Move to a new section on the Hub, below the avatar circles: "✨ Collective Synergy" — show a one-line summary, expandable to full view

**MBody Roulette spinner** → Move into each person's Flow tab as a small icon button (🎲) in the top-right corner. On click, show the roulette result in a modal/overlay, not a full page

**Working Docs page** → Remove as standalone page. Add the links contextually:
- Notion workspace link → Hub Tools dropdown
- Shared Drive links → Hub Tools dropdown
- Any person-specific doc links → that person's Work tab

**Update navigation:** Remove "Playground" and "Working Docs" from the nav. Final nav should be:
- Hub (home icon)
- Geyser (rocket/flame icon)
- Sunshine (avatar)
- Monny (avatar)
- Bingle (avatar)

This reduces nav from 6-7 items to 5, cutting decision points at the top level.

---

