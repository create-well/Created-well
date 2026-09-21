# Plan: System Page Optimization + Source Architecture

## Context

The System page (`/system`) currently shows live data counts (Tasks, Stations, Forum posts, etc.) as plain numbers with no links — the user can see *how many* records exist but can't navigate to the source databases or the dashboard views that display them. The page also has no reference to the project's external content channels (newsletter, podcast, socials). This plan adds clickable navigation to every data row, wires in all external source URLs as a reference hub, and extends the page with dashboard/hub improvement suggestions as a lightweight feature section.

---

## File to modify

**`src/app/pages/SystemPage.tsx`** — sole target. All additions stay in this file.

---

## 1. Upgrade `DataCountRow` to support dual links

Extend the component signature:

```ts
function DataCountRow({
  label, count, emoji,
  internalPath,   // react-router path — clicking the label navigates internally
  notionHref,     // Notion database URL — small "↗ Source" badge opens in new tab
}: {
  label: string; count: number; emoji: string;
  internalPath?: string; notionHref?: string;
})
```

**Rendering logic:**
- Wrap the `label` in a `<Link to={internalPath}>` (import `Link` from `react-router`) when `internalPath` is provided — label becomes a tappable internal nav link.
- When `notionHref` is provided, append a small `↗` anchor badge aligned right of the count, opening in `_blank`. Style it as a subdued secondary action (muted color, tiny font).

**UX rationale:** Internal links keep users in the workflow; the Notion `↗` is for admin/source access. Both coexist without cluttering the row.

---

## 2. Add `NOTION_DB_LINKS` config (top of file)

```ts
const NOTION_DB_LINKS: Record<string, string> = {
  tasks:         'https://notion.so/<tasks-db-id>',
  stations:      'https://notion.so/<stations-db-id>',
  forum:         'https://notion.so/<forum-db-id>',
  messages:      'https://notion.so/<messages-db-id>',
  workshops:     'https://notion.so/<workshops-db-id>',
  coFlowDates:   'https://notion.so/<coflow-dates-db-id>',
  checkins:      'https://notion.so/<checkins-db-id>',
  wellNotes:     'https://notion.so/<wellnotes-db-id>',
  brainDumps:    'https://notion.so/<braindumps-db-id>',
  announcements: 'https://notion.so/<announcements-db-id>',
};
```

During implementation, use the Notion MCP to look up actual database IDs and replace placeholders. If a DB ID can't be resolved, the `notionHref` prop is simply omitted (no broken link).

---

## 3. Wire up data inventory rows

Replace each `<DataCountRow>` call with the dual-link version:

| Label | `internalPath` | `notionHref` key |
|---|---|---|
| Tasks | `/moves` | `tasks` |
| Stations | `/moves` | `stations` |
| Forum posts | `/moves` | `forum` |
| Messages | `/care` | `messages` |
| Workshops | `/flows` | `workshops` |
| CoFlow dates | `/flows` | `coFlowDates` |
| Check-ins | `/care` | `checkins` |
| Well notes | `/` | `wellNotes` |
| Brain dumps | `/` | `brainDumps` |
| Announcements | `/` | `announcements` |

---

## 4. Add "Content channels" section

New section below "Build info" (or between "Build" and end), showing all 8 external sources as clickable `LinkRow` items.

```ts
const CONTENT_CHANNELS = [
  { label: 'Newsletter',      emoji: '📬', href: 'https://www.sunshinedgtlstudios.com/cr8wnewsletter' },
  { label: 'Events (Partiful)', emoji: '🎉', href: 'https://partiful.com/uYXpeCS9xuzmgObb7Q7jf' },
  { label: 'Book Club RSVP',  emoji: '📚', href: 'https://docs.google.com/forms/d/e/1FAIpQLSdru8LxeVv8HqjxAHMZ0pgFRcPs3bw8uSk7FjqxeHWKn-Urg/viewform' },
  { label: 'YouTube',         emoji: '▶️',  href: 'https://www.youtube.com/@brbcreatingwell' },
  { label: 'Spotify',         emoji: '🎵', href: 'https://open.spotify.com/show/0Tj253e1ZAE7vsKd4Tffvi' },
  { label: 'Apple Podcasts',  emoji: '🎙️', href: 'https://podcasts.apple.com/us/podcast/brb-creating-well-a-create-well-podcast/id6795904154' },
  { label: 'Amazon Music',    emoji: '🎶', href: 'https://music.amazon.com/podcasts/e1ff7602-912c-488b-a11f-e6fb6027dbba' },
  { label: 'Instagram',       emoji: '📸', href: 'https://www.instagram.com/brbcreatingwell' },
];
```

Rendered as a card with a `LinkRow` component (inline with the existing style): `emoji + label` on the left, `↗ href domain` on the right as a muted link, same visual language as `HealthRow`.

---

## 5. Upgrade "Registered routes" to "Site architecture"

Rename the section from "Registered routes" to **"Site architecture"** and expand each route row to show:
- Emoji + route label (already there)
- Route path (already shown as the value)
- Add a tertiary `Sub: data source` line under each entry showing which data collections it relies on

This makes the system page a genuine reference doc for the dashboard structure.

Example extension for the row data:

```ts
{ path: '/', label: 'This Week at the Well', emoji: '💧',
  sources: 'brain dumps · announcements · well notes · coflow dates' },
{ path: '/moves', label: 'Moves: Now', emoji: '⛲️',
  sources: 'tasks · stations · forum posts' },
{ path: '/care', label: 'Care Loop', emoji: '🫧',
  sources: 'messages · check-ins · well notes' },
```

Rendered by extending `HealthRow` or replacing it inline with a 3-line variant for this section only.

---

## 6. Dashboard + team hub improvement suggestions

Add a final **"Suggested improvements"** section (clearly marked as non-live), rendered as a lightweight card with a checklist-style list of upcoming improvements. Items:

- **Notion deep links from every data row** *(this plan — in progress)*
- Add Omar to Moves task filter *(completed this session)*
- Real-time announcement push (replace `prompt()` with a modal form)
- Weekly digest email/Notion page auto-generated from brain dumps
- Per-person coflow date RSVP tracking
- Hub widget: "last sync from Notion" visible on home page
- Decision Queue (`/decisions`) connected to Notion database
- Money page (`/money`) linked to Google Sheets source

Style: `opacity: 0.65`, italic label, checkbox icon — signals aspirational not production-ready. Clicking any item could navigate to the relevant route if implemented.

---

## Implementation notes

- Import `Link` from `react-router` at the top of `SystemPage.tsx` (it's already a react-router v7 project)
- `NOTION_DB_LINKS` and `CONTENT_CHANNELS` are module-level constants — no new files needed
- All new components (`LinkRow`) are local functions in SystemPage.tsx — no new files
- No changes needed to `data.ts`, `DashboardContext`, or any other file

---

## Verification

1. `pnpm run build` → clean with no new errors
2. Navigate to `/system` — data inventory rows show labels as tappable links; `↗` Notion badges appear next to counts
3. Click an internal link (e.g. "Tasks") → navigates to `/moves`
4. Content channels section shows all 8 links opening correctly in new tabs
5. "Site architecture" section shows route source annotations
6. Suggestions section renders without breaking layout
