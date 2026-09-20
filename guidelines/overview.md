# Brand Overview

## Character

CR8W Create Well is an **internal creative team dashboard** for a small, close-knit team (6 users). The aesthetic is warm, human, and purposefully creative — not a cold enterprise SaaS tool. Every surface should feel like it was made *by* the team *for* the team.

## Design philosophy

**Warm minimalism.** Space is used generously; information is never crammed. Cards breathe. Navigation is calm.

**Brand-forward color.** Sage green and lavender are the primary palette — not neutral grays. The UI should feel tinted, not sterile.

**Playful but professional.** Fredoka for display text adds personality. Blinker for UI keeps it sharp. The two work in tension on purpose.

**Dashboard density = medium.** Tables and data surfaces show enough information to be useful; they do not fill every pixel. Whitespace is an intentional design choice, not wasted space.

## Surface strategy

| Surface | Token | Use |
|---|---|---|
| Page background | `--background` (`#ffffff`) | Main canvas |
| Card / panel | `--card` (`#ffffff`) with border | Elevated content blocks |
| Sidebar | `--sidebar` (near-white) | Navigation rail |
| Input backgrounds | `--input-background` (`#f3f3f5`) | Form fields |
| Muted regions | `--muted` (`#ececf0`) | Subtle zones, tab lists |

## Palette philosophy

- **Sage (`#7BA89D`)** — primary actions, active states, focus rings
- **Lavender (`#B8A9D4`)** — secondary actions, badges, tag decorations
- **Brand orange (`#C25B38`)** — used sparingly for CTAs and high-priority callouts; not in the CSS token system by default, apply as a one-off
- **Deep purple (`#2D2438`)** — dark text on lavender, dark mode base

## Corner philosophy

`--radius: 0.625rem` (10 px) is the base unit. The scale:
- `rounded-sm` → `calc(0.625rem - 4px)` = 6 px
- `rounded-md` → `calc(0.625rem - 2px)` = 8 px  
- `rounded-lg` → `0.625rem` = 10 px ← default
- `rounded-xl` → `calc(0.625rem + 4px)` = 14 px

Avoid fully rounded pills except for badge/tag use cases.

## Elevation

This kit uses **border + background** for elevation rather than box-shadow. Cards sit on `--card` with a `border-border` (rgba black 10%) edge. Modal overlays use `bg-black/50`.

## Typography hierarchy

| Role | Font | Weight |
|---|---|---|
| Page titles / hero | Fredoka | 600–700 |
| Section headings | Blinker | 600 |
| UI labels, nav, buttons | Blinker | 400–600 |
| Body / descriptions | Montserrat | 400 |
| Small captions | Montserrat | 300–400 |
| Data / tabular | Blinker | 400 |
