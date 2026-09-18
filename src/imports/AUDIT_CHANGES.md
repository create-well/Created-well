# CR8W Dashboard — Final Audit Changes
**Applied:** 2026-02-27  
**Files modified:** `index.html`, `app.js`, `style.css`

---

## FIX 1 — Mobile nav text mismatch
**File:** `index.html` · line 71  
**Change:** Mobile menu label "Working Docs" → "Docs" to match desktop nav label.  
Both nav items now consistently read `📄 Docs`.

---

## FIX 2 — Notion sync banner dot status
**File:** `index.html` · line 83  
**Change:** `<span class="notion-sync-dot offline">` → `<span class="notion-sync-dot online">`  
The green pulsing dot now correctly reflects the "Notion workspace linked" text beside it.

---

## FIX 3 — Remove stale past calendar event
**File:** `app.js` · `CALENDAR_EVENTS` array (~line 113)  
**Change:** Removed `Third St Arts Mixer` entry with `date: '2026-02-26'` (yesterday).  
All remaining CALENDAR_EVENTS are dated 2026-02-27 or later.

---

## FIX 4 — Google Calendar embed graceful fallback
**File:** `index.html` · Hub "Live Calendar" section (~line 169)  
**Change:** Wrapped the existing `<iframe>` inside an updated `.calendar-embed-card` that now includes a `<div class="calendar-embed-note">` beneath the iframe. The note prompts the user to sign into Google in this browser or open Google Calendar directly via a link.

---

## FIX 5 — Add `.calendar-embed-note` CSS
**File:** `style.css` · after `.calendar-iframe` rule (~line 618)  
**New rules added:**
- `.calendar-embed-note` — flex row, peach-haze background, rounded bottom corners, 0.78rem font
- `.calendar-embed-note a` — deep-rust color, underline, font-weight 500
- `.calendar-note-icon` — 1rem font-size, flex-shrink: 0  

Also adjusted `.calendar-iframe` border-radius to `var(--radius-lg) var(--radius-lg) 0 0` so the iframe top corners remain rounded while the bottom connects flush to the note bar.

---

## FIX 6 — Warmer person calendar "not linked" message
**File:** `app.js` · `renderCalendar()` else block (~line 1382)  
**Change:** Replaced generic "Calendar not linked yet. Sign into your Google account..." with warmer brand-aligned copy:  
*"Calendar integration ready — just sign into Google in this browser to view it here. No extra setup needed."*

---

## FIX 7 — Auto-refresh every 60 seconds
**File:** `app.js` · end of `DOMContentLoaded` callback (~line 237)  
**Change:** Added `setInterval(() => { loadAllData(); }, 60000)` so the dashboard silently reloads all API data every minute, keeping tasks, brain dumps, announcements, and stations fresh without a manual page refresh.

---

## FIX 8 — Last-synced timestamp indicator
Three-part change:
- **`index.html`** (~line 86): Added `<span class="notion-sync-time" id="notion-sync-time"></span>` inside `.notion-sync-bar`, after the Notion link.
- **`app.js`** (~line 293): At end of `loadAllData()`, reads `notion-sync-time` element and writes the current time as `"Last synced: H:MMam/pm"`.
- **`style.css`** (~line 2966): Added `.notion-sync-time` rule — 0.68rem, text-muted color, `margin-left: auto` to right-align it, 70% opacity.

---

## FIX 9 — `.notion-sync-dot.online` CSS rule
**File:** `style.css` · after `.notion-sync-dot.offline` rule (~line 2956)  
**Change:** Added explicit `.notion-sync-dot.online` rule:
```css
.notion-sync-dot.online {
    background: #6BAF6B;
    box-shadow: 0 0 6px rgba(107, 175, 107, 0.5);
}
```
The base `.notion-sync-dot` rule already had the green fill and pulse animation; the `.online` class now makes it explicit and distinct from the `.offline` (muted, no animation) state.

---

## FIX 10 — Person assignee selector in Add Task modal
Two-part change:
- **`index.html`** (~line 686): Added a new `.form-group` with `<select id="task-person">` immediately after the Title input in `#add-task-form`. Options: ☀️ Sunshine, 🌊 Monny (default), ✨ Bingle.
- **`app.js`** (~line 1567): In `submitNewTask()`, replaced hardcoded fallback logic with:
  ```javascript
  const personSelect = document.getElementById('task-person');
  const targetPerson = currentPerson || (personSelect ? personSelect.value : 'sunshine');
  ```
  When adding a task from the Geyser view (no `currentPerson`), the selector value drives the assignment.

---

## Summary
| Fix | File(s) | Type |
|-----|---------|------|
| 1 — Mobile nav label | index.html | Content |
| 2 — Sync dot class | index.html | Bug fix |
| 3 — Remove past event | app.js | Data cleanup |
| 4 — Calendar iframe fallback | index.html | UX improvement |
| 5 — Calendar note styles | style.css | New CSS |
| 6 — Warmer calendar msg | app.js | Copy/UX |
| 7 — Auto-refresh interval | app.js | Feature |
| 8 — Last-synced timestamp | index.html + app.js + style.css | Feature |
| 9 — `.online` dot style | style.css | New CSS |
| 10 — Task assignee selector | index.html + app.js | Feature |
