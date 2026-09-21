Based on the full Figma Make canvas data, the current state is confirmed. Here is the next deployment prompt, ready to copy and paste directly into the Make chat:[1]

***

```
CONTEXT: Version 62 clean (6.40s). Shipped:
- CalendarConnectCard.tsx — all 6 states live on /system
- theme.css — success/error tokens added
- AuthGate stale-session fix — SIGNED_OUT + refresh token error paths
  both call clearStaleSession(), wiping 4 localStorage keys

PENDING FROM V58 (blocked by Vite root error, now unblocked):
FlowCommandCenter.tsx, FlowsPage.tsx, notionNormalizer.ts were
implemented but never landed. Re-apply them now.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — notionNormalizer.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status map (exact, no additions):
  Idea → idea | Ready → ready | Approved → approved
  Scheduled → scheduled | Happened → happened
  Wrapped → wrapped | Cancelled → cancelled
  (Remove: Planning, Confirmed — dead statuses)

MONEY date priority: Actual date first → Expected date fallback.
No other field order accepted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — FlowCommandCenter.tsx
Path: src/app/components/FlowCommandCenter.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sections (in order, no omissions):

1. WEEKLY RHYTHM STRIP
   - 7-day row, current gathering day highlighted in Sunshine #C25B38
   - Upcoming: Idea/Ready/Approved/Scheduled badges only
   - Archived: Happened/Wrapped/Cancelled (muted, no color fill)

2. TOPIC WELL & QUESTION BANK
   - Primary CTA: "drop it in" (Blinker, uppercase, Sunshine fill)
   - Anonymous drop toggle: when ON, synthesizer Monny sees content
     only — no member identity shown anywhere in the stack
   - Topic Stack: categories locked to verified event types:
     Podyap, Open Studio, Book Club, Workshop, Pop-Up,
     Surprise-ment, Geyser, Internal
   - Collective resonance controls: "mmm-hmm" / "unh-unh" 
     vote buttons with live count
   - Flow Keeper Override banner (conditional, shows when active):
     "Flow Keeper's gut overrode the vote. The topic is [X]"
   - Question Bank: expandable prompt selector, depth indicators:
     Surface | Cultural | Somatic

3. ROTATING ROLES CARD
   Four role pills, reassigned each gathering:
   Flow Keeper · Closer · Benediction · Tech Anchor
   Plus: Locked Topic badge + Recording Day/Time + Omar's Gear pill

4. LIVE GEAR CARD (exact values — no placeholders ever)
   Rodecaster Pro: Noise Gate OFF · Compressor ON · Limiter ON -3dB
   Mics: boom stands, pop filters, calibrated -16dB to -12dB
   DJI Osmo: synced, battery 100%, backup audio rolling
   Omar's Shortcut of the Week: compact tip chip

5. WEEECORDING TIMELINE
   - 25-Minute Breath marker (DJI cutaway, dialogue uninterrupted)
   - Same-Day Decomprocessing card: 30-min, Flow Keeper leads
     "what flowed, what flooded" → feeds next Monday's pooling

6. RECOVERY LOCK BANNER (conditional)
   "Space in Recovery Lock — metrics unlock in [X]h"
   Color: --color-warning (#964219 light / #bb653b dark)
   Appears for 24–72h post-gathering

7. SYNC PROVENANCE CHIP (top-right, always visible)
   "Synced from Notion FLOWS · [timestamp]"
   fresh = --color-success | stale = --color-warning

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — FlowsPage.tsx
Path: src/app/pages/FlowsPage.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Import and mount <FlowCommandCenter /> wired to useDashboard()
- Route: /flows
- No status badges outside FLOW_STATUS_MAP canonical set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN TOKENS (unchanged — reference only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fonts:
  Fredoka — display, headings ≥24px only
  Montserrat — body copy
  Blinker — labels, buttons, tags (uppercase, tracked)

Profile colors (Monny #7BA89D, Sunshine #C25B38 etc.):
  Avatar fills, borders, 10–15% tint backgrounds ONLY
  All label text → Dark Slate #2C2C2C regardless of profile

Token reference:
  --color-success:  #437a22 light / #6daa45 dark
  --color-warning:  #964219 light / #bb653b dark
  --color-error:    #a12c7b light / #d163a7 dark
  (never --color-notification for error states)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE TABLE (strict — zero deviations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ "drop it in" — Topic Well CTA
✓ "the well" — never "the calendar" or "the hub"
✓ "flow motion" — transition animation label
✓ "mmm-hmm / unh-unh" — resonance vote labels
✓ "Pleasure Dollars" — never "credits" or "budget"
✓ "fresh / stale" — sync health states
✓ "Space in Recovery Lock — metrics unlock in [X]h"
✓ "what flowed, what flooded" — Decomprocessing prompt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. notionNormalizer.ts — corrected status map + MONEY date priority
2. FlowCommandCenter.tsx — all 7 sections, both states
3. FlowsPage.tsx — /flows route mounted and wired
4. Desktop frame 1280px + Mobile frame 375px, Figma Auto Layout
5. Build must pass clean — target ≤8s, zero new errors
```

Sources
[1] pasted_text_1789997516.txt https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/110212548/713910f1-8924-4264-a2b6-a44c56ee9846/pasted_text_1789997516.txt?AWSAccessKeyId=ASIA2F3EMEYE6MYNOCNQ&Signature=b3TaKk0fy39z2oouVyc9F81ob4c%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEMj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCICXmMLd5ruS6z3P%2Fq0baHCsAc9KP3Xp6PsvaQs877IuqAiEAl5MGobXzSBVblGKcy9fQ9hb736lruVEu7JSUW7PkjXIq%2FAQIkf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDOKLtYxXVY5ZVfsqlyrQBN8tnvN6XxQkQ4lcgY48L0JH%2FMQHpUi6TkZZ1kIustEtsn5ph3iK8T1Ypk3rymOfexgwEZ%2BxzxKX368%2F37xNjX1gzbPzNe952wddw0%2FW83b%2BdaFevjzC%2BVCM8OsJwBKAjcsfYVAYV96WARsRYhY3Oc6ic8eBoSUT5X0kditV7RJu7PVsOXKvnCW8Z2HDXpo4WJYi3bO%2F%2B5lPGOxye7nMqx0ps0t1PW6Wb5wKfptxTLUgBamYBJZ4F6MetL8kRG%2Fsn2aEve%2BIupgCak2csRpjxmbtvwL29uQ7s9AH8bPAeLS7FPYbFFi%2BLWBw1wObxEol5h0j74k2clhJT9Nq1RZNPEZxXoF6tRnpb6N5N1rCEClxqEtQSdsBISD%2FojuHr3kUF744IOuEqcQ7c64xCze2r25tdFAwkPT%2Fftm%2FwiBu8qMmhLZduktvC72hg8bp2EkUXLfm0kq6Q0mM5QFTH5cnuQn1lUTCDbNGOMDOIEGH%2BX1Xt%2BGINTm4tJQOMyAxtsU9QvMQJ0ZSiOhedwjtCaZJcM%2BEEihnIRquuhp%2FT1A8ApmUxYJRaCo2yMpJ0I653Ai0Oot3yMREHYFidxeZtu7m5q%2FihWeAovZ7HnpS4BJYF5S8FN59iUdOvMMKhVaX8ZIJbi6qFe1QyscwWEUmx%2FYUqhOmpP%2Fgnr%2FqxuF32Zo61k0Z8GFSoj38yWwT0lXkzy1sC1bdv1%2FfpEnvWmQK3XKnDuRYqAfCyQuOKqt4oPk%2FDHiKT9lNu5gCLBSAWAbje8MkvK67D6jdr8%2BpZmoiSgvjwgIwq6TF1QY6mAFae8ak%2FQy1%2FlNmElgIZ9ggtYldj2ncq3gmmVkejfuLFbzEBjUtspvgD5XZRgL3tvDuletomqIlFspa4IBO4MeUhsiasfCXUkXh%2BoetVmfpQA55rxlxQEScuTcD4MWJthG3NG549lcfVnf2ISWXLzwz3Ju2yfvEAHytf5Y9PouDCeMXTA49UrXFB%2Bj87IDqcvkKY%2FUrcwLinw%3D%3D&Expires=1790009342
