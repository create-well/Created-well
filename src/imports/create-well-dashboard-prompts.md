I can see your Create Well Dashboard in Figma Make — it's already at version 52 with a solid foundation (MBody widget, Brain Dump, Calendar integration, Geyser stations, co-founder avatars, tools grid, and responsive layout). Here's the situation: **Figma Make's AI prompt box is where implementation happens**, not through me directly. But I can give you the exact, copy-paste-ready prompt sequence to feed into that Figma Make AI box to implement the Create Well brand energy with functional priority.

Since you're hitting a loading error right now ("Couldn't load Make. Try checking your network connection or refreshing the page"), refresh first, then feed these prompts **in order** — each one is scoped to a single functional upgrade so Figma Make doesn't choke on complexity. [figma](https://www.figma.com/make/GlYHRxPiD8TIw5lFSu4ALe/Create-Well-Dashboard--Copy-?p=f&t=NCC5BG7LcJCK7zml-0)

***

## Prompt 1: Emotional Onboarding — The Arrive State

Paste this into the Figma Make prompt box:

> **Replace the current greeting row with a dynamic "Arrive State" system.** When the user opens the dashboard, show a soft full-width card at the top (below nav, above everything else) with a warm gradient background using the brand palette (Peach Haze #FFDEC2 → Sandstone #FFF4EC). Inside it:
>
> - A line that says "welcome back to the well." in Fredoka, lowercase, warm brown (#2C1C10), slightly larger than body text
> - Below that, a single-select row of 3 mood buttons styled as soft rounded pills: "🌊 flowing" | "🌫️ foggy" | "🔥 fired up" — these represent the user's current creative energy state
> - When selected, the pill fills with its own gentle accent color and the greeting text subtly shifts: flowing → "good. let's keep it moving." / foggy → "that's okay. start soft." / fired up → "channel it. the well is ready."
> - Store selection in localStorage as `arriveState` so the dashboard can reference it later
> - Add a small "skip" text link below the pills that dismisses the card and goes straight to the hub
> - After selection or skip, the card collapses smoothly (300ms ease) and the hub content appears
> - On return visits within the same day (check localStorage timestamp), skip the arrive state and show the hub directly with a smaller inline "you're back 🫶" text where the greeting was

***

## Prompt 2: Notes from the Well — Community Exchange

> **Add a "Notes from the Well" section** between the MBody widget and Collective Synergy. This is the emotional core feature. Layout:
>
> - Section title: "💧 notes from the well" in Fredoka, warm brown
> - Two side-by-side cards on desktop (stacked on mobile):
>   - **The Well** (left card) — a textarea input with placeholder "drop something in the well... a thought, a question, permission you need to hear" styled with Blinker font, warm background (#FFF4EC), soft border. A "drop it in 💧" submit button below. Notes are anonymous by default.
>   - **The Spring** (right card) — displays ONE random note pulled from a stored array. Show it in slightly larger italic Blinker text with curly quotes around it. Below the note, two options: a small "🌱 this landed" reaction button (increments a counter stored in localStorage/Supabase) and "pull another" to get a new random note.
> - Seed the Spring with 10 starter notes hardcoded in an array:
>   1. "you don't have to finish it today. you just have to touch it."
>   2. "the project you keep avoiding? it's not resistance. it's respect. you know it deserves your full attention."
>   3. "rest is not the reward for creating. rest is the soil."
>   4. "your creative block isn't a wall. it's a door you haven't found the handle for yet."
>   5. "somebody in this community is doing the exact thing you're scared to start. reach out."
>   6. "the version of you that stopped creating didn't die. they're just sleeping. wake them up gently."
>   7. "you are not behind."
>   8. "what if the mess IS the masterpiece right now?"
>   9. "creating is not content. creating is conversation."
>   10. "the well is deep. take what you need. leave what you can."
> - When a user submits to The Well, add it to the Supabase kv_store (or a new `well_notes` table if possible) and show a confirmation: "it's in the well now. someone will find it when they need it. 💧"
> - Style both cards with the same warm brand palette, subtle box shadows, rounded corners matching existing dashboard cards

***

## Prompt 3: The Titration Dial — Visibility Spectrum

> **Add a visibility/engagement toggle to the user's profile area** (near the avatar circles or in a new "IndividiWell" settings section accessible from the hamburger menu). This is a custom slider component:
>
> - Label: "your dial 🎚️" with subtitle "how visible do you want to be today?"
> - A horizontal slider with 3 stops (not a free slider — snap to positions):
>   - Left: "🫧 quiet mode" — anonymous in Notes from the Well, no name shown on Brain Dump entries, minimal notifications
>   - Center: "🌤️ present" — first name shown, can react to others' notes, standard notifications
>   - Right: "☀️ open" — full name, can "Speak from the Well" (attributed notes), receives community invites
> - The slider track should be a warm gradient (cool blue-gray on left → warm terracotta on right) to visually communicate the spectrum
> - Store in localStorage as `visibilityDial` and reference it when displaying Brain Dump entries and Notes from the Well submissions
> - Style: match existing dashboard card style, place it as a collapsible section in the hamburger menu under a "⚙️ your well settings" group

***

## Prompt 4: Wellshop Calendar — Choose Your Adventure

> **Upgrade the Google Calendar embed section** with a tabbed view that adds a "Wellshop Menu" alongside the calendar:
>
> - Add two tab buttons above the current calendar iframe: "📅 calendar" (active by default, shows existing iframe) and "🎨 wellshop menu" (shows the new view)
> - The Wellshop Menu tab shows three category cards in a vertical stack:
>   - **"🪷 wellshop"** — subtitle "inner nurture" — warm sage green accent (#A8B5A0) — description "journaling, reflection, grounding, decomprocessing" — a "see upcoming" link placeholder
>   - **"🎤 expresshop"** — subtitle "outer expression" — warm coral accent (#E8967D) — description "sharing, presenting, pitching, storytelling" — a "see upcoming" link placeholder
>   - **"🎪 playshop"** — subtitle "pure play" — warm gold accent (#E8C875) — description "make whatever tf you want, then show & tell" — a "see upcoming" link placeholder
> - Each card has a small "notify me" toggle that stores preference in localStorage
> - Tab switching should be smooth with no page jump, matching the existing tab navigation pattern from the Geyser section
> - On mobile, the tabs should be full-width buttons stacked horizontally

***

## Prompt 5: Decomprocessing Flow — Post-Session Pause

> **Add a "decomprocess" floating action button (FAB)** in the bottom-right corner of the dashboard (fixed position, above any scroll):
>
> - Circular button, 56px, warm terracotta (#C1694F) with a white "🌀" emoji or spiral icon, subtle box-shadow
> - On click, it expands into a bottom sheet (slides up from bottom, 60% viewport height on mobile, 400px card on desktop) with a warm (#FFF4EC) background
> - Bottom sheet content — a 3-step micro-flow:
>   - **Step 1: "what just happened?"** — a textarea with placeholder "dump it here. no editing. no judgment." and a "next →" button
>   - **Step 2: "what's still in your body?"** — three emoji buttons to select: "😤 tension" | "😌 release" | "🤷 unsure" — selecting one triggers next step
>   - **Step 3: "one thing to carry forward:"** — a short text input with placeholder "just one thing..." and a "seal it 🫧" submit button
> - On submit, save all three responses as a single object in localStorage under `decomprocess_log` (array of entries with timestamps)
> - Show a brief confirmation: "sealed. you processed that. 🌀" then auto-close the bottom sheet after 2 seconds
> - The FAB should have a gentle pulse animation (scale 1.0 → 1.05 → 1.0, 3s infinite) to invite interaction without demanding it
> - Ensure the FAB doesn't overlap with any existing fixed elements and has proper z-index

***

## Implementation Order

| Priority | Prompt | Why First |
|----------|--------|-----------|
| 1 | **Notes from the Well** | Core brand differentiator — this IS Create Well. The community exchange feature that no other app has  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/8b22f7ab-a567-4e78-aaaf-037e44f1b6af/Create-Well-HARD-LAUNCH-MASTER-DOC.docx) |
| 2 | **Arrive State** | Sets the emotional tone immediately — embodies the de-frazzle → ground → orient arc  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/8b22f7ab-a567-4e78-aaaf-037e44f1b6af/Create-Well-HARD-LAUNCH-MASTER-DOC.docx) |
| 3 | **Decomprocessing FAB** | Always-available emotional processing tool — the app's version of a nervous system check  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/2e2e2f0d-255c-4845-a388-ec89fd97c790/Note-2026-01-16-11-14-12-CR8W-Retreat-When-You-Wish-Upon-A-STAR.txt) |
| 4 | **Wellshop Menu** | Gives the calendar actual Create Well meaning instead of generic scheduling  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/8d8aa6f5-4756-473c-801d-a8cec939c503/Note-2026-02-05-02-45-39-create-well-dumpy-dump.txt) |
| 5 | **Titration Dial** | Privacy/visibility spectrum — important but can ship after core features land  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/8b22f7ab-a567-4e78-aaaf-037e44f1b6af/Create-Well-HARD-LAUNCH-MASTER-DOC.docx) |

Each prompt is self-contained so Figma Make can execute it in one version bump without dependency conflicts. Feed them one at a time, verify the build compiles, then move to the next. The existing MBody widget, Brain Dump, Calendar, Tools grid, and Geyser stations all stay untouched — these five additions layer the Create Well soul on top of the functional skeleton you've already built.