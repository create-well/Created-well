# V63 Session State — 2026-09-21

## Build status
- Version: **V63** — clean, zero errors
- Build time: 11.89s (environment overhead; code itself is lean)
- All three V58 pending tasks now landed

---

## What shipped in V63

### TASK 1 — notionNormalizer.ts
**Status: DONE**

`FLOW_STATUS_MAP` rewritten. Now outputs canonical lowercase status names directly.
No generic fallbacks. Exact map:

```typescript
const FLOW_STATUS_MAP: Record<string, CoFlowDate['status']> = {
  'idea':      'idea',
  'ready':     'ready',
  'approved':  'approved',
  'scheduled': 'scheduled',
  'happened':  'happened',
  'wrapped':   'wrapped',
  'cancelled': 'cancelled',
  'canceled':  'cancelled',  // variant spelling → canonical
};
```

Default fallback: `'idea'` (was `'upcoming'`).

MONEY date priority: `Actual → Expected` was already correct — no change needed.

### TASK 2 — FlowCommandCenter.tsx
**Status: DONE — all 7 sections**

Path: `src/app/components/FlowCommandCenter.tsx`

1. **Weekly Rhythm Strip** — real 7-day current-week strip; gathering days Sunshine `#C25B38`; Upcoming badges filled, Archived muted
2. **Topic Well & Question Bank** — "drop it in" Sunshine CTA; anonymous toggle; Flow Keeper Override banner; `mmm-hmm`/`unh-unh` with live counts; Question Bank with Surface/Cultural/Somatic depth
3. **Rotating Roles Card** — Flow Keeper/Closer/Benediction/Tech Anchor; Locked Topic badge; Recording Day/Time; Omar's Gear pill
4. **Live Gear Card** — exact values: Rodecaster Pro (Noise Gate OFF · Compressor ON · Limiter ON −3 dB), Mics (−16 to −12 dB), DJI Osmo (synced, 100%, backup rolling); Omar's Shortcut chip
5. **Weeecording Timeline** — 00:00 Arrive / 25:00 Breath marker (Sunshine highlight) / 50:00 Benediction; Same-Day Decomprocessing card ("what flowed, what flooded")
6. **Recovery Lock Banner** — conditional; `--color-warning`; "Space in Recovery Lock — metrics unlock in [X]h"; shows 0–72h post-gathering
7. **Sync Provenance Chip** — top-right header, always visible; "Synced from Notion FLOWS · [timestamp]"; fresh = `--color-success`, stale = `--color-warning`

### TASK 3 — FlowsPage.tsx
**Status: DONE (was already correct)**

`/flows` route already mounted `<FlowCommandCenter />` correctly. No changes needed.

---

## Ripple changes from canonical status type update

`CoFlowDate.status` type changed in `src/app/components/api.ts`:
```typescript
// Before:
status: 'upcoming' | 'active' | 'archived';
// After:
status: 'idea' | 'ready' | 'approved' | 'scheduled' | 'happened' | 'wrapped' | 'cancelled';
```

All consumers updated:

| File | Change |
|------|--------|
| `src/app/components/CommunityEventsView.tsx` | `statusPill()` rewritten; filters use `FLOW_ARCHIVED` Set |
| `src/app/components/CoFlowD8sView.tsx` | Filters updated; new record default `'idea'`; "mark archived" → `'wrapped'` |

---

## Design tokens (all in theme.css)

```css
/* :root */
--color-success:     #437a22;
--color-success-bg:  rgba(67, 122, 34, 0.1);
--color-warning:     #964219;       /* ← added V63 */
--color-warning-bg:  rgba(150, 66, 25, 0.08);  /* ← added V63 */
--color-error:       #a12c7b;
--color-error-bg:    rgba(161, 44, 123, 0.08);

/* .dark */
--color-success:     #6daa45;
--color-success-bg:  rgba(109, 170, 69, 0.12);
--color-warning:     #bb653b;       /* ← added V63 */
--color-warning-bg:  rgba(187, 101, 59, 0.1);  /* ← added V63 */
--color-error:       #d163a7;
--color-error-bg:    rgba(209, 99, 167, 0.1);
```

---

## Previously shipped (V62 and before)

| What | Path | Status |
|------|------|--------|
| CalendarConnectCard — all 6 states | `src/app/components/CalendarConnectCard.tsx` | ✓ |
| useCalendarSync() hook | `src/lib/useCalendarSync.ts` | ✓ |
| GCAL_CLIENT_ID | `src/app/components/data.ts` | ✓ `1075308813287-od6j8oaf5or22qgt2d9v55gkutv4jq83.apps.googleusercontent.com` |
| AuthGate stale-session fix | `src/app/components/AuthGate.tsx` | ✓ SIGNED_OUT + getSession error handled |
| CalendarConnectCard on /system | `src/app/pages/SystemPage.tsx` | ✓ |
| figmaAssetPlugin | `vite.config.ts` | ✓ |

---

## Language table (zero deviations)

| Term | Context |
|------|---------|
| "drop it in" | Topic Well CTA |
| "the well" | never "the calendar" or "the hub" |
| "flow motion" | transition animation label |
| "mmm-hmm / unh-unh" | resonance vote labels |
| "Pleasure Dollars" | never "credits" or "budget" |
| "fresh / stale" | sync health states |
| "Space in Recovery Lock — metrics unlock in [X]h" | Recovery Lock Banner |
| "what flowed, what flooded" | Decomprocessing prompt |

---

## Kit notes

- Kit: `@cr8w/design-system` — `dist/index.js: var e = () => null` (Button is a null stub)
- `FlowCommandCenter.tsx` uses shadcn `./ui/*` components (Button, Badge, Card, Switch, Accordion) — these are local project components, NOT the CR8W stub. They work.
- `CalendarConnectCard.tsx` uses raw `<button>` elements with justification comment citing the null stub.

---

## Transcript location

```
/workspaces/default/sessions/54280de5-565f-4567-9d9a-b0b095e02300/claude/projects/-workspaces-default-code/b4eb9058-603c-4798-a348-4ade83a1a5b7.jsonl
```
