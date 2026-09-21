# CR8W Figma Make Prompt

Paste this whole file into the Figma Make thread for `Created-well`. It defines what you build, what you never touch, and the four states every surface must have.

This prompt is the frontend half. Its pair is **CR8W Master Build Prompt**, which handles Notion, Supabase, Vercel, and env. Where the two disagree, the Master Build Prompt wins on data and infrastructure. This one wins on interface.

---


---

## SCOPE LOCK, decided 2026-09-18. This overrides anything below it.

**Internal dashboard only. Do not build the public surface.**

- `aboutcreatewell.netlify.app` stays the front door. It is not yours. Do not replicate it, link-jack it, or plan for its migration.
- The internal dashboard lives at **`dash.cr8w.com`**. `cr8w.com` serves an unrelated Figma Sites export. See Section 0.1.
- **Delete `src/public/` from your plan.** Section 3's public route tree and all of Section 4's public filters are **PARKED**. Skip them.
- The `src/app` / `src/shared` boundary still holds. `src/shared` now means shared between internal surfaces, not between internal and public.
- Every hour freed goes into two places: **internal UI/UX depth** and **team usage**. Sections 12 and 13 below are where that effort lands. They are not optional extras. They are the work.

**Your actual user base is six people who open this every day:** monny, sunshine, bingle, pia, omar, and whoever is holding Additional Event Support this season. Design for repeat daily use by people who already know the content. That means speed, keyboard flow, density control, and knowing where you left off. Not onboarding, not explanation, not marketing.

**The governing law, quoted from the Create Well Lexicon:**

> An agent, a system, or a template may prepare the water. It never decides when the water moves. That decision belongs to the people holding the Well.

In interface terms: nothing sends, publishes, invites, or schedules on its own. Every outbound action renders as a staged draft with a visible human release step. There is no "auto" anything. If you build a toggle that would let the system act unattended, you have broken the law.

## SECTION 0. GROUND TRUTH AS OF 2026-09-18, 10:54 PDT. READ THIS FIRST.

Everything below this section was written before the backend was verified live. Where
anything later in this file disagrees with this section, **this section wins.**

### 0.1 Where this thing actually lives

| Surface | Host | Who serves it | Your job |
|---|---|---|---|
| **Internal dashboard** | `dash.cr8w.com` | Vercel, project `createdwell` | **This. Only this.** |
| Public marketing | `aboutcreatewell.netlify.app` | Netlify | Not yours. Do not touch. |
| `cr8w.com` and `www.cr8w.com` | Figma Sites (`sites.figma.net`) | a static export | Not yours. Do not plan around it. |

Three corrections to what earlier versions of this file said:

- **`cr8w.com` is not the dashboard and never was.** Its DNS points at Figma Sites behind
  Cloudflare. Any host allowlist entry for `cr8w.com` is wrong. Use `dash.cr8w.com`.
- **Do not hardcode any API origin.** `VITE_API_BASE` is `/api/server`, same-origin and
  relative on purpose, so the app works on `dash.cr8w.com`, on a preview URL, and on
  localhost with no per-host branching. If you write an absolute origin anywhere, you have
  introduced a bug that only shows up on one host.
- **Production is behind a shared passphrase**, not Vercel login. Assume every visitor is
  already through it and is one of six known people. Do not build a login screen, a user
  menu, an account page, or a sign-out button. There are no accounts.

### 0.2 The write path was dead, and the UI lied about it

This is the most important thing in this file.

Until today, every edit the team made looked like it saved and did not. The API route
wrote to Supabase, returned 201, and let the Notion write fail into a log line. Its own
comment said *"never throws so KV writes always succeed."* Every property name it sent was
wrong, so Notion 400'd every single time. The UI showed a success state on top of a
failure. For weeks.

**The interface lesson: never render success for an operation you have not confirmed.**

Every write now returns a `notionSync` object alongside the item:

```ts
type NotionSyncResult = {
  state: 'written' | 'partial' | 'failed' | 'skipped';
  db?: string;          // 'MOVES' | 'FLOWS' | 'PEOPLE' | 'CONTENT'
  pageId?: string;
  dropped?: { property: string; reason: string }[];
  message?: string;
};
```

**You must surface all four states. Build this, do not skip it.**

| `state` | What happened | What the UI says |
|---|---|---|
| `written` | Notion has it | quiet confirmation, no badge needed |
| `partial` | saved, but some fields were dropped | amber chip, "saved. 2 fields did not fit." Click opens the `dropped` list, each with its reason. |
| `failed` | Notion rejected it | red chip, "saved here, not in Notion." Show `message`. Offer retry. |
| `skipped` | Notion not configured for this surface | grey chip, "local only" |

`partial` and `failed` both mean **the row in front of you does not match the database.**
That is a real state the team needs to see, not an error to hide. A silent success is worse
than a visible failure. Use the phrase book in Section 12, never the word "error".

### 0.3 There is no priority field. Stop rendering one.

MOVES has **no** priority property. It never did. `Task.priority` exists in the local type
and is **never written to Notion**. Any priority pill you render is local decoration that
resets on the next sync and cannot be trusted.

Either drop it from the UI, or label it plainly as a local-only sort with a tooltip saying
so. Do not let it look like shared state. Two people will disagree about it and both will
be looking at their own browser.

The real signal of urgency is `Due` plus `Touchpoint`. Use those.

### 0.4 Verified live schemas. These are authoritative. Do not invent fields.

**MOVES** (tasks)

| Property | Type | Options |
|---|---|---|
| `Name` | title | |
| `Status` | select | Now, Next, Done, Dropped |
| `Type` | select | Prep, Day-Of, Follow-Up, Admin, Content |
| `Touchpoint` | select | Thank-you (24-48h), Check-in (Day 5-7), Next invite (Day 10-14), Personal invite (after 2nd), Other |
| `Due` | date | |
| `Owner` | relation → PEOPLE | |
| `Person` | relation → PEOPLE | |
| `Flow` | relation → FLOWS | |
| `Blocked By` | text | |
| `Notes` | text | |

There is no `Priority`, no `Due Date`, no `Category`, no `Source`. Earlier versions of the
code used all four. All four 400'd.

**FLOWS** (events)

`Name` title · `Status` select [Idea, Scheduled, Ready, Approved, Happened, Wrapped,
Cancelled] · `Type` select [Podyap, Open Studio, Book Club, Workshop, Pop-Up,
Surprise-ment, Geyser, Internal] · `Phase` select [Cohoe, Concepting, Coordinating,
Marketing, Day of, Decomprocessing, Depanty] · `Offering Arc` select [Sense, Name, Design,
Practice, Integrate, Sustain] · `Readiness Outcome` select [Not yet, Start here, Ready for
depth] · `Date` datetime · **`Media Cutoff` date** · `Thank-you Due` date · `Venue` text ·
`Hard Stop` text · `Notes` text · `Retro` text · `Primary Invitation` text · `Desired
Body-Feel` text · `Capacity` number · `Public?` checkbox · `Public URL` url · `Drive
Folder` url · `Flow Keeper` / `Support` / `Guests` / `Attended` relations → PEOPLE ·
`Moves` relation → MOVES · `Money` relation → MONEY

It is `Venue`, not `Location`. `Flow Keeper`, not `Host`. `Retro`, not `Session Notes`.
There is no `Theme` and no `Time Range`.

**`Status` and `Phase` are different questions.** Status is whether it is happening. Phase
is where in the making it is. Render them as two separate controls. Earlier code collapsed
them into one field and lost information.

**PEOPLE**

`Pathway Stage` select: Arrive, Exhale, Come Home, Return, Deepen, Paused, Do Not Contact.

`Next Invitation`, and this is Monny's own description of the field:

> "The single most important field in the system. Blank means nobody gets contacted."

**Nothing in the dashboard has ever displayed it.** Fix that. See 0.7.

### 0.5 Media Cutoff is a person's deadline, not a data point

`Media Cutoff` on FLOWS. Monny's description: *"Omar deadline. Thursday for Podyaps."*

It sat in the database for months with no surface reading it, so the one person it belongs
to had no way to see it coming. It now counts down on the flow card and is editable in
place.

Treat it as a first-class deadline everywhere flows appear, equal weight to the event date.
Omar's home view should lead with it.

### 0.6 One date rule. It is already built. Use it, do not reinvent it.

`src/lib/whenLabel.ts`. Import it. Do not write date maths in a component.

```
no date  -> "no date set"
overdue  -> "3 days late", or "yesterday"
0 / 1    -> "today" / "tomorrow"
2-6      -> "in 4 days"
7-13     -> "Thu, Oct 2 - in 9 days"
14+      -> "Oct 8"
```

**Why 14 days:** that is the MOVES `Touchpoint` return rhythm, Day 10-14. Inside that
window you are counting down. Outside it you are reading a calendar. The cut is not
arbitrary and should not be tuned without a reason.

Three rules that came out of real bugs:

- **Done and dropped items show a plain date and never read as late.** A finished task
  saying "6 days late" is noise that trains people to ignore the colour.
- **The full date, with weekday and year, is always in the `title` attribute.** The short
  label never hides information, it only defers it.
- **Parse date-only strings field by field in local time.** `new Date('2026-09-24')` is UTC
  midnight, which is 5pm September 23rd in Las Vegas. Two components shipped with this bug
  and rendered every date a day early.

Tones are in `WHEN_TONE_COLOR`: none, late, today, tomorrow, soon, near, far. Use them.
Never use red for a date that is merely close.

### 0.7 What the team can edit now, and what still needs building

**Done:**

- Moves: due date, Touchpoint, Type, title, status
- Flows: Media Cutoff, Thank-you Due, Type, Phase

Pattern is `InlineDate` / `InlineSelect` in `src/app/components/InlineDate.tsx`. Click the
value, edit in place, blur commits, Escape cancels. Select options are hardcoded from the
real Notion lists so a typo cannot invent a new option in the database. Clearing a date is
allowed on purpose: "no date set" is a real answer and beats a made-up deadline.

**Build next, in this order:**

1. **`Next Invitation` on every person.** The most important field in the system, still
   invisible. It is a text field. Make it editable inline, and surface people whose
   `Next Invitation` is blank as the first thing on the Care surface. Blank means nobody
   gets contacted.
2. **`Pathway Stage`** as an inline select on each person. Seven options, listed in 0.4.
   Respect `Do Not Contact` everywhere: no invite affordance, no bulk action, no exception.
3. **Owner, Person and Flow relation pickers.** These resolve by name to a page id. The
   writer drops names it cannot resolve and reports them in `dropped`, so a picker that
   only offers real names is worth more than a free-text field.
4. **Blocked By as a sentence, not a flag.** `blocked` is a dashboard state with no Notion
   option. The reason is written into the `Blocked By` text field. If someone marks a move
   blocked without a reason it writes "Blocked, reason not given", which is honest and
   slightly embarrassing on purpose. Prompt for the reason.
5. **A `notionSync` indicator on every editable surface.** See 0.2. This is the payoff for
   the whole write-path fix and it does not exist in the UI yet.

### 0.8 The provenance envelope is real. Render it.

`/api/dashboard` returns `meta.degraded` and `meta.sources`, where every section reports
`source`, `status`, `rows`, and a `detail` string when it failed.

Right now, live: ten Supabase sections `ok`, and all four Notion sections `error` with
`API token is invalid`. `degraded: true`.

**So the dashboard's honest current state is: no people, no moves, no flows, no content,
and a named reason why.** Build for that. It is not an edge case, it is today.

- `degraded: true` must be visible at the top level, once, calmly. Not a modal.
- Each empty section says why it is empty, in its own space, using its `detail`.
- Never render an empty section as "Nothing here yet" when `status` is `error`. That is the
  same lie as the silent write, in a different costume.
- A section with `status: ok` and `rows: 0` genuinely is empty. Say so differently.

### 0.9 Governance, unchanged and non-negotiable

> Notion writes. Supabase remembers. `dash.cr8w.com` reads. Nothing writes backward.

> One write surface per fact.

> Stale beats wrong.

The dead write path violated the third one in the worst direction: it was wrong and
presented as fresh. When you are unsure whether to show a number or show a reason, show
the reason.

---

## SECTION 0a. THE FOUR BREAKS. Verified in the code you generated. Fix all four.

**Read this before anything else. This section is not a suggestion and it outranks Section 0 below.**

### Why this section exists

`create-well/Created-well` is the only repo for this product.

**Superseded, corrected 2026-09-18 17:50 UTC:** the repo now has human commits, and **Git
IS connected to the Vercel project `createdwell`**. Pushing a branch triggers a build, and
merging to `main` rebuilds production. The claim below that every deploy is a direct upload
was true when written and is now false. `main` is at `3ec611d`. The project serves
**`dash.cr8w.com`**, not `www.cr8w.com`.

Two consequences, and they are the whole reason this section is at the top:

1. **You are the only author.** A human patch to `main` gets overwritten the next time you publish. So a fix that is not in your output is not a fix.
2. **Your output ships through review now.** Branch, PR, wait for CodeQL and the Vercel checks, merge. That is the gate. `main` rebuilds `dash.cr8w.com` on merge. Correctness is still yours, but you are no longer one keystroke from production.

### Correction to Section 0's ownership list

Section 0 below says you do not own `api/server.ts` or `api/server/[[...path]].ts`. That was wrong. **You wrote both of them.** The accurate rule:

- You may write those two files, and only those two, inside `api/`.
- You must write them to the spec in Break 3 below and nowhere else.
- Everything else in Section 0's do-not-edit list still holds: `supabase/functions/`, `scripts/`, `vercel.json`, env, DNS.

### Break 1. The host allowlist. **PARTLY SUPERSEDED, read Section 0.1 first.**

The diagnosis below was right about the fallthrough. The hostname was wrong: the internal
domain is **`dash.cr8w.com`**, and `cr8w.com` belongs to an unrelated Figma Sites export.
Better fix than an allowlist: `VITE_API_BASE=/api/server` is relative, so same-origin works
on every host with no list to maintain. Prefer that. Keep an allowlist only if something
still needs an absolute origin, and if so use `.cr8w.com` and the `.vercel.app` preview
domains.

In `src/app/components/api.ts`, `resolveApiBase()` matched `createwell.monnyfest.co` but never `cr8w.com`. The live internal domain therefore failed the first-party test and fell through to the Supabase Edge Function on every single request.

Emit exactly this shape. Suffix matching, not equality, so `www`, previews, and future subdomains are covered:

```ts
const isFirstParty =
  host.endsWith('.vercel.app') ||
  host === 'cr8w.com' ||
  host.endsWith('.cr8w.com') ||
  host === 'createwell.monnyfest.co' ||
  host.endsWith('.monnyfest.co') ||
  host === 'localhost' ||
  host === '127.0.0.1';
if (isFirstParty) return '/api/server';
```

### Break 2. The fallthrough origin cannot authenticate, and the comment claimed otherwise

The old comment in `api.ts` read: "the Edge Function has verify_jwt:false so the sb_publishable key in the Authorization header is sufficient."

That is false. `make-server-dabe1c74` has **`verify_jwt = TRUE`**. A `sb_publishable_...` string is not a JWT. Every request down that path returns 401. Break 1 was sending all of production down it.

Rules:

- Fixing Break 1 is what fixes this. No first-party host may ever reach the Edge Function base.
- The Edge Function base stays as a Figma Make preview path only. Label it in a comment as degraded and 401-ing. Do not claim it works.
- Read the key from `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` with the existing literal as a fallback, so no deploy breaks before the env var is set. Do not delete the literal in the same change that moves it. Rotation is a separate decision and not yours.

### Break 3. Two API handlers, and the one that served every request used a table that does not exist

This is the one that silently ate all your writes.

- `api/server.ts` is correct. `TABLE = 'kv_store_dabe1c74'`, which is the only KV table in Supabase project `irtqcygriedvdijppntz`. It carries the Notion write-through via `./notionWriter`. It parses `req.query.path`.
- `api/server/[[...path]].ts` carried a **333-line stale duplicate** of that same API with `TABLE = 'kv_store_8dcd9693'`. That table does not exist.
- Vercel file routing gives `api/server.ts` only the exact path `/api/server`. So `/api/server/sync`, `/api/server/tasks/...`, and every other real route was served by the duplicate, against a missing table, with no Notion write-through.

The fix is deletion, not repair. `api/server.ts` already parses `req.query.path` with the identical convention, so it was always meant to be the catch-all. **The entire body of `api/server/[[...path]].ts` must be exactly this, plus a comment:**

```ts
export { default } from '../server';
```

Hard rules, permanent:

- There is exactly **one** `TABLE` constant in `api/`, and its value is `'kv_store_dabe1c74'`.
- There is exactly **one** Supabase client factory in `api/`.
- `kv_store_8dcd9693` is a dead string. Never emit it again.
- Never put route logic in `api/server/[[...path]].ts`. It delegates, and that is all it does.

### Break 4. The dashboard reported `fresh` while showing data with no Notion in it

In `src/contexts/DashboardContext.tsx`, `fetchSync()` tried `api.fetchDashboard()`, the Notion-backed source. On failure an inner `catch` fell back to `api.sync()`, which is KV only. Then execution continued to `setSyncStatus('fresh')`.

So the worst case rendered as the best case. That is the exact thing "stale beats wrong" exists to prevent.

`'stale'` is already a member of the `SyncStatus` union in `src/types/dashboard.ts` and had never once been used. Use it:

```ts
let usedFallback = false;
if (api.isDashboardAvailable) {
  try {
    data = await api.fetchDashboard();
  } catch (primary) {
    data = await api.sync();
    usedFallback = true;
  }
} else {
  data = await api.sync();
  usedFallback = true;
}
// ...
setSyncStatus(usedFallback ? 'stale' : 'fresh');
```

Generalize it. **A fallback path may never set the success state.** If any surface degrades its source, the status it reports degrades with it. Degrade the label, never the data.

### Break 5, housekeeping. No `.gitignore`

The repo shipped without one, so `node_modules/`, `dist/`, and `.env` were all stageable. Emit a `.gitignore` that covers `node_modules/`, `dist/`, `.vercel/`, `.vite/`, `.env`, `.env.*` with a `!.env.example` exception, `*.log`, and `.DS_Store`.

### How to verify these five

This repo is a Figma Make export with **no `tsconfig.json`**, so there is no `tsc` gate. `npm run build` via Vite and esbuild is the only check that exists. It must pass. Do not report a typecheck you did not run.

## 0. Your role and your blast radius

> **Amended by the Scope Lock.** One audience, not two: the internal team. One codebase, one data contract, one surface.

You build the interface for Create Well. Two audiences, one codebase, one data contract.

**You own:**

- Everything under `src/`
- Components, routes, layout, type, motion, states, copy in the UI
- The normalizer at `src/lib/notionNormalizer.ts`, shape only

**You do not own, and must not edit:**

- `api/server.ts` and `api/server/[[...path]].ts`
- Anything in `supabase/functions/`
- `scripts/`
- `vercel.json`, env configuration, DNS

If a surface needs data the contract does not carry, stop and say which collection and which field. Do not invent a fetch.

---

## 1. Hard stops

Read these twice. Each one is a thing that already went wrong.

1. **Never create a Notion database.** A previous Make run created four empty databases named MOVES, PEOPLE, CONTENT, and FLOWS that shadowed the real ones. They had zero rows and incompatible schemas. Every database already exists. You read them through the API, never directly.
2. **Never create a Supabase table, function, or migration.**
3. **Never hardcode a Notion database ID, a Notion page ID, a Supabase URL, or any key.** All of it arrives through the API response. If you see a hardcoded id in existing code, flag it, do not copy the pattern.
4. **Never add a second fetch origin.** There is exactly one API base, resolved by `resolveApiBase()`. Do not add an absolute Supabase URL, a proxy, or a direct Notion call from the client. The existing Edge Function fallthrough is the one exception, it is preview-only, and it currently 401s. See Break 2.
5. **Never write back to Notion** except through the three sanctioned buttons: Sync Calendar, Sync Notion, Promote Intake.
6. **Never render mock data.** `src/app/components/data.ts` currently has five constants that are empty arrays: `CALENDAR_EVENTS`, `MILESTONES`, `STATIONS_DEFAULT`, `GUEST_JOURNEY`, `DEFAULT_ANNOUNCEMENTS`. Do not refill them with invented rows. Wire their consumers to the live collections or give them a real empty state.
7. **Never let a failed load look like a successful empty one.** See section 7. And never let a degraded load look like a fresh one. See Break 4.
8. **Never leak an internal field to the public surface.** See section 4.

---

## 2. The data contract

One typed response. Read it, do not extend it without saying so.

```ts
type SyncStatus = 'fresh' | 'stale' | 'failed' | 'loading';

interface SyncMeta {
  status: SyncStatus;
  lastSynced: string | null;   // ISO 8601, null means never
  silentFailCount: number;
  source: 'primary' | 'fallback';  // fallback must never report fresh
}

interface SyncData {
  // Notion-backed, five lanes
  tasks: Task[];               // MOVES
  stations: Station[];         // PEOPLE
  coflowDates: CoflowDate[];   // FLOWS
  forum: ForumPost[];          // CONTENT
  money: MoneyRow[];           // MONEY
  programs: Program[];         // PROGRAMS, new

  // Supabase KV, nine lanes, no Notion source
  messages: Message[];
  forumReplies: ForumReply[];
  braindumps: Braindump[];
  announcements: Announcement[];
  workshops: WorkshopInstance[];
  workshopPrograms: WorkshopProgram[];
  workshopResources: WorkshopResource[];
  coflowCheckins: Checkin[];
  wellNotes: WellNote[];

  // Cache
  calendarEvents: CalendarEvent[];

  meta: SyncMeta;
}
```

Two changes from what is in the repo today: `money` and `programs` are new. Both are Notion-backed. Add them to the interface and to every surface listed in section 9.

### Status values you must handle

`Task.status` is `'todo' | 'in_progress' | 'done' | 'dropped'`.

`dropped` is new and it is **visible**. It is a real outcome in this system, not a failure. Give it its own treatment: muted, legible, not struck through, not hidden, not folded into blocked. A dropped move is a decision that was made, and the interface should honor it.

### Role keys

`TASK_ROLES` must cover six people: `sunshine`, `monny`, `bingle`, `pia`, `omar`, `event-support`. The facilitator union currently typed `'monny' | 'sunshine' | 'bingle'` is too narrow. Widen it. Never let an unknown role key render as a blank avatar or crash a filter.

### Phase tags

Keep all seven exactly as named: Cohoe, Concepting, Coordinating, Marketing, Day of, Decomprocessing, Depanty. These are not generic project phases. Do not rename them to something more legible. They are the vocabulary.

---

## 3. Site architecture

Two surfaces, one build, hard boundary between them.

### Internal: the team dashboard

Behind auth. This is the working cockpit for six people. Dense is fine. Ugly truth beats pretty guessing.

```
/                  This Week at the Well
/flows             Flows, all dated things, Podyap preflight
/moves             Moves, now and next
/care              Care Loop, the people layer
/money             Money, real only
/programs          Programs, the offerings that repeat        [new]
/decisions         Decisions log
/system            System health, sync state, glossary
```

> **PARKED by the Scope Lock. Do not build this section.** Kept for reference only, for whenever the public surface is actually commissioned.

### Public: the front door

No auth. This is where a stranger meets Create Well and decides to show up. Spacious, slow, generous. One clear invitation per screen.

```
/                          Landing
/gather                    Everything upcoming, one list
/gather/:programSlug       A program: Book Club, a workshop series, Open Studio
/podyap                    The podcast, episode index
/podyap/:episodeSlug       One episode
/rsvp/:flowId              One event, one form
/about                     Who we are, the well
```

### The boundary rule

The public surface reads a **separate payload**. It never receives the internal one. Public data is already filtered server side before it reaches the client. Your job is to never write a component that imports an internal type into a public route.

Enforce it structurally:

- `src/public/` for public routes and components
- `src/app/` for internal, as it is now
- `src/shared/` for tokens, primitives, and the water language, nothing with a field name in it

If a public component needs to know about `Readiness Outcome`, `Retro`, `Hard Stop`, `Media Cutoff`, `Thank-you Due`, `Support`, `Money`, or `Notes`, you have crossed the line. Those are internal fields. Public sees `Name`, `Date`, `Venue`, `Capacity`, `Primary Invitation`, `Public URL`, and published copy. Nothing else.

---

> **PARKED by the Scope Lock. Do not build this section.**

## 4. Public filters, stated once

The server applies these. Build the UI assuming they already happened, and assume nothing else.

- **Events:** `Public? = true` AND `Status` in Scheduled, Ready, Approved AND `Date >= today`
- **Programs:** `Public? = true` AND `Status` in Open, Running
- **Copy and resources:** `Audience = Public` AND `Status = Published`
- **People:** only those explicitly marked public. Default is invisible. No email, no phone, no consent field, ever, on a public route.

Past events are not public. A past event appears on the public site only as a Podyap episode with published copy.

---

## 5. Design system

The metaphor is a well. It is already in the code: 369 references to geyser, plus spring, ripple, and the well. Do not replace it with generic wellness visuals. Do not add stock imagery of water.

### The allegory, and what it maps to

- **The well** is the shared resource. Depth means the work already in it.
- **Levels** are how deep someone is: passing by, drawing water, tending, keeping.
- **The geyser** is the pressure release. It is what the team does when something has built up. In the interface it is energetic, not alarming. Never red.
- **Spring** is where things start. New, arriving, first time.

### Type

Two families, no more. One with real personality for headlines, one that stays quiet at small sizes for dense internal tables. Set a modular scale and hold it. Internal can go to 14px body. Public floors at 17px.

Public headline sizes should feel spoken, not shouted. Large, low contrast in weight, generous leading.

### Color

Build from the existing theme tokens. There is a `ThemeSelector` already, respect it.

- One water family carrying depth, light to deep, used for hierarchy not decoration
- One warm accent for invitation and action, used sparingly
- Semantic set: done, in progress, dropped, stale, failed. `dropped` gets its own token, not gray-that-means-disabled.
- Test every pairing at 4.5:1 minimum. The theme selector must not be able to produce an unreadable combination.

### Motion

Default to almost none. Where motion exists it should feel like settling, not bouncing. 150 to 250ms, ease-out.

`prefers-reduced-motion` removes all of it, including autoplay, parallax, and any looping ambient animation. This is not optional. Check `SensorySettings` and `VisibilityDial`, which already exist, and make them actually govern motion, contrast, and density.

### Density

Internal defaults to comfortable, not compact, with a density toggle. Public is always spacious.

---

## 6. Build order

Stop and report after each group.

**Group 1: honesty layer.** Do this before any new surface.

1. Add `money` and `programs` to `SyncData` and the context.
2. Add `dropped` to the task status union with its own visual treatment.
3. Widen the facilitator union. Add `pia` and `omar` to `TASK_ROLES`.
4. Make `SyncStatusBar` read `meta.source`. A fallback load must render as stale with a timestamp, never fresh.
5. Give all four states to every existing surface, per section 7.
6. Wire or retire the five empty constants in `data.ts`.

**Group 2: internal completion.**

7. `/money` reads the MONEY lane. Real numbers only, no projections.
8. `/programs`, new. Each program card shows its type, cadence, current focus, keeper, and its upcoming instances.
9. `WorkshopsView` reads `programs` for the definition and `coflowDates` for the instances. Stop treating workshops as loose KV rows.
10. Confirm each of the seven internal pages renders at least one field traceable to a named Notion property. List which property per page.

**Group 3: public surface.**

11. Create `src/public/` and `src/shared/`. Move tokens and primitives into shared. Nothing with a field name goes in shared.
12. Landing. One invitation, the next three gatherings, what the well is.
13. `/gather` and `/gather/:programSlug`.
14. `/podyap` and `/podyap/:episodeSlug`, reading published Episode Copy.
15. `/rsvp/:flowId`. Name, email, consent checkbox, one optional note. Consent is unchecked by default and the form cannot submit without it. Post to the intake endpoint. Show a real confirmation, not a toast that disappears.
16. Capacity honesty. If an event has a capacity and it is met, the form says full and does not accept.

**Group 4: polish.**

17. Responsive down to 360px. The internal tables get horizontal scroll with a sticky first column, not a broken stack.
18. Keyboard path through every interactive element. Visible focus ring everywhere.
19. Per-route metadata and social cards for the public routes.
20. Full accessibility pass, section 8.

---

## 7. The four states

Every surface that touches data has four states. Not three. Build all four or the surface is not done.

| State | What it looks like | What it never does |
|---|---|---|
| **Loading** | Skeleton matching the real layout | Spinner over blank, layout shift on arrival |
| **Empty** | Real sentence naming what would be here and how it gets here | "No data" |
| **Stale** | Content plus a visible last-synced timestamp | Hide the timestamp, look identical to fresh |
| **Failed** | Last known content, banner saying the sync failed and when it last worked | Render zeros, render empty, report fresh |

Empty and failed look different. A person must be able to tell "there is nothing scheduled" apart from "we could not reach the data." Write the empty copy per surface, in the voice. "Nothing on the calendar yet" is fine. "No records found" is not.

Stale beats wrong. That is a standing rule. If you are unsure whether a number is current, say so on screen.

---

## 8. Accessibility and sensory defaults

This is built by and for neurodivergent people. These are requirements.

- `prefers-reduced-motion` honored fully, everywhere
- No autoplay of audio or video, including on `/podyap/:slug`
- No infinite loop animation, no parallax, no marquee
- 4.5:1 contrast minimum on text, verified for every theme
- Focus visible on every interactive element, never `outline: none`
- Every icon-only control has an accessible label
- Forms: label above input, error text below, error never carried by color alone
- Tap targets 44px minimum
- Nothing time-limited. No countdown that removes an option.
- `SensorySettings` and `VisibilityDial` actually work and persist

---

## 9. Surface to source map

Build against this. If a row is missing, ask.

| Surface | Collection | Notion source | Notes |
|---|---|---|---|
| `/` internal, This Week | `coflowDates`, `tasks` | FLOWS, MOVES | This Week at the Well view |
| `/flows` | `coflowDates` | FLOWS | Podyap Preflight view, Omar's home |
| `/moves`, `GeyserView` | `tasks` | MOVES | Moves: Now view |
| `/care`, `PersonView` | `stations` | PEOPLE | Care Loop and Next Right Invitation views. Consent gate applies. |
| `/money` | `money` | MONEY | Money, Real Only view |
| `/programs` | `programs`, `coflowDates` | PROGRAMS, FLOWS | Program plus its instances |
| `/system` | `meta` | none | Sync state, glossary, row counts |
| `/decisions` | `braindumps`, `wellNotes` | none, KV | |
| `MessageDrawer` | `messages` | none, KV | |
| `NotesFromTheWell` | `wellNotes` | none, KV | |
| Public landing, `/gather` | `coflowDates` | FLOWS, public filter | |
| `/gather/:slug` | `programs`, `coflowDates`, `forum` | PROGRAMS, FLOWS, CONTENT | Event Copy and Resource types |
| `/podyap` | `coflowDates` Type=Podyap, `forum` | FLOWS, CONTENT | Episode Copy type |
| `/rsvp/:flowId` | `coflowDates` | FLOWS | Writes to intake, not Notion |

Event types in FLOWS, all seven plus internal: Podyap, Open Studio, Book Club, Workshop, Pop-Up, Surprise-ment, Geyser, Internal. `Internal` never reaches a public route.

---

## 10. Verify before you report

Each of these you can check yourself.

1. `rg "kv_store_" src/` returns nothing. The client never names a table.
2. `rg -i "notion" src/public/` returns nothing.
3. No Notion or Supabase id appears anywhere in `src/`.
4. Every surface in section 9 has all four states from section 7.
5. A dropped task renders visibly as dropped.
6. All six role keys render an avatar and a label.
7. With motion reduced, nothing animates.
8. Every theme passes 4.5:1 on body text.
9. The public route tree imports nothing from `src/app/`.
10. Tab reaches every control on every route, with a visible ring.

---

## 11. How to report

After each group:

- What changed, file paths, one line each
- Which checks in section 10 now pass
- What is still broken
- One binary question if you need one, then stop

Writing style for anything a person reads on screen: specific and embodied. Short sentences. No em dashes. No corporate speak. Never use these words: tapestry, landscape, pivotal, foster, underscore, interplay, intricate, enhance, embark, beacon, multifaceted, myriad.

Lead with the answer. Top-level bullets only. No recaps.

End every response with `Smallest Next Action:` followed by one task under 15 minutes or one binary decision.

---

## 12. Language contract, from the Create Well Lexicon

Source doc: `create-well-lexicon`, 2026 Edition. This is not tone guidance. These are the literal strings.

### Names you must use exactly

| Surface | Name |
|---|---|
| Dashboard home | **This Week at the Well** |
| Archive view | **Past cycles & drafts** |
| Weekly team cowork session | **Cohoe** |
| The team / collaborators | **Co-Hoes**, **Co-creators** |
| Founding holders | **Pillars** |
| Host roster | **The bench** |
| The podcast | **the source**, or **Podyap** |
| Low-frequency recurring touchpoints | **Water drops** |
| Debrief | **Depanty** |
| Cool-down window | **Decomprocess** |
| Something alive but not moving | **Open drop** |
| Active Flow ↔ Well relation | **Currents in motion** |
| Minimum baseline mode | **Tending the source** |

"This Week at the Well" means *what's happening and what is not ready.* Build both halves. A "not ready" column is required, not a nice-to-have. That is where the honesty lives.

"Past cycles & drafts" empty state copy, verbatim: *"If something here is still alive, move it back. Do not run the Well from this shelf."*

### Banned strings. Add a lint rule.

```
funnel, call to action, CTA, convert, conversion, post-mortem, retrospective,
backlog, stakeholder, headcount, networking, deliverable, nurture sequence,
lead conversion, resource allocation, event activation, optimize the funnel,
scale the community, capture attendees, growth hacking, engagement metrics
```

Replacements, non-negotiable:

| Use | Never |
|---|---|
| A return path | Funnel |
| Invitation | Call to action |
| Come home | Enter ecosystem |
| Hold the room | Manage attendees |
| Co-creator / Co-Hoe | Resource, headcount, labor |
| Shared creative presence | Networking |
| What's alive? | What's the deliverable? |
| Tending the Well | Scaling operations |
| Water drops | Low-ticket recurring events |
| The underground river | Content pipeline |
| Reciprocal energy | Lead qualification |
| Deepen | Convert |
| Decomprocess | Post-mortem |
| Depanty | Retrospective |
| Open drop | Backlog item |
| Flowing > forcing | Optimize at all costs |

### Status-word policy

Terms carry a status in the Lexicon. **Ship ESTABLISHED only.**

- PROPOSED, do not use as a label yet: `Draw + Tend`, `Ofcoursement`, `Check the waterline`. Where you need them, use the ESTABLISHED equivalent and leave a code comment.
- INFORMAL, keep out of the interface entirely: `TestiMONNY` / `Testimonnyyy`. The Lexicon says explicitly not to make it a field name. Honor that.

### The phrase book, for empty states and confirmations

Real things the team says. Use them where a generic string would go.

- "Does this have water?"
- "What wants to move?"
- "Keep it as an open drop."
- "Decomprocess before we decide."
- "What's the ofcoursement?"
- "Is this a true yes, or just exciting?"
- "Do we have enough Well for this?"
- "Gut-check first."
- "Flowing, not forcing."
- "The system should remember so nobody has to hold it all in their body."
- "Nothing to do today."
- "It should feel like something opening up, not something being asked of them."

That last one is the acceptance criterion for every screen. Read the screen and ask it.

### Voice rules

Never: corporate flattening. Urgency or hustle framing. Asking for silent labor. Using a Geyser to disguise an under-tended Well. Letting the system decide when the water moves.

Always: write for someone deciding whether it's safe to enter. One clear invitation per touchpoint. **Name the boundary alongside the invitation.** Log the yes and the no. **Let limits read as design, not apology.**

**Design note, quoted:** *"Keep one accent color for boundaries and stop rules so limits read as design, not apology."* One accent, reserved. Stop rules, capacity ceilings, consent blocks, hard stops and the Decomprocess lock all share it. Nothing else may use it. A boundary should look intentional, never like an error.

---

## 13. Team usage. This is where the freed effort goes.

Six people, daily. Build for them.

### 13.1 Per-person home

`TASK_ROLES` has six keys: `sunshine`, `monny`, `bingle`, `pia`, `omar`, `event-support`. The facilitator union must widen to include all six; it currently only allows three.

On sign-in, "This Week at the Well" reorders for who you are. Same data, same components, different order. No separate dashboards, no role-gated hiding.

| Person | Role, from the wiki and Lexicon | Their first block |
|---|---|---|
| monny | Systems + Community Bridge, async-first | Open drops needing a decision, and anything blocked on her |
| sunshine | Vision + Backend Operations, studio owner, Pillar | Venue, money, sponsor confirmations |
| bingle | Momentum Keeper, in-person presence + content, Pillar | Day-of and Hold the space |
| pia | Dashboard co-creator | Content and copy status |
| omar | Tech Anchor for Podyap production | **Media Cutoff dates. Thursday for Podyaps.** Surface this loudly. |
| event-support | Flowing role, shifts with season | Day-of run-of-show only |

A person who is not the Flow Keeper still sees everything. "Faces, not a single face." Reordering is not permissioning.

### 13.2 Presence and handoffs

- **Who is here** · quiet presence row, initials only. No green dots, no "active 4m ago," no idle shaming. Presence should feel like company, not surveillance.
- **Who is looking at this** · on a Flow or a Move, show initials of anyone else with it open. Prevents two people editing the same row.
- **Handoff** · an explicit action on a Move: pass it to another person with one line of context. The Lexicon frame is invitation, never assignment. Copy: "Drop deeper into the well" for inviting more involvement. The receiver can decline, and a decline is a logged state, not a failure.
- **Last seen by you** · remember where each person left off and offer to return there. Do not force it.

### 13.3 Shared sense-making

- **Drop it in** · a global capture input, always reachable, one keystroke. Captures an idea, ask, tension, or opportunity with zero required fields beyond a sentence. No commitment implied. This is the most important control in the product. Build it first.
- **Does this have water?** · on any open drop, a lightweight gut-check any Co-Hoe can register. Not a vote, not a score. A signal, with the person's name on it.
- **Currents in motion** · one view of every active Flow and what it is drawing from the Well.
- **Depanty** · a shared debrief surface per Flow. Money in/out, decisions, follow-up, reusable assets, friction named plainly, open loops returned to Cohoe. Multiple people write into the same one.

### 13.4 The Decomprocess lock

A Flow within 24-72 hours after its date enters a protected window. In that window the UI shows **care copy only**: how did that feel, what do you need, rest. No metrics, no Depanty fields, no analysis. The lock is enforced in the code and uses the boundary accent.

The Lexicon is explicit that Decomprocess comes *before* evaluation. Making that a real interface state is the single clearest way this product carries the culture instead of describing it.

### 13.5 Care Loop

The 14-Day Return Rhythm as a working surface.

| When | Action | Rule shown in the UI |
|---|---|---|
| At RSVP | Confirmation, add to calendar | No extra ask |
| At event | Visible QR, "come home" | Mention once |
| 24-48h | Thank-you | One primary invitation |
| Day 5-7 | Human check-in | Warm relationships only |
| Day 10-14 | Next invitation | **No event = no email** |
| After 2nd event | Personal invitation | Specific ask, never vague |

Every item renders as a **staged draft**. A person releases it. Nothing sends itself.

`Consent Captured` blank disables the outbound control outright, with the reason readable on hover. No override in the UI. Not a warning, a disabled state.

"No event = no email" is enforceable: if no Flow is scheduled, the Day 10-14 row is disabled and says so.

### 13.6 Metrics, deliberately uneven

"Return and reciprocity, not attention theater."

| Signal | Display |
|---|---|
| Attendees logged | Complete / incomplete |
| **Thank-you sent** | **Percentage against 90% within 48 hours. The only tile with a goal line and a red state.** |
| Invitations sent | Count, where permission exists |
| Came home | Direction arrow, no target |
| Returned | Trend over time, no target |
| Deepened | Count, small is correct |
| Relationship notes | Presence, not volume |

Do not add a target to a signal the Lexicon left open. The unevenness is the point. Five of these tiles having no goal line is a design decision, not an unfinished state.

### 13.7 Levels of the Well as navigation

The offerings are levels, bottom to top. Navigation reflects that. The Well fills from the bottom up.

```
Above  ·  Geyser            rare, sponsor-anchored, 3+ months
  6    ·  Surprise-ments    unplanned synchronicity
  5    ·  Pop-Ups           seasonal, in the wild
  4    ·  Monthly Workshops $10-50, 15-25 people, the heart
  3    ·  Book Clubs        free, time-bounded, has an end date
  2    ·  Open Studio Days  $10, shared creative presence
  1    ·  Podyap            weekly, the source
```

Current real state to render: Book Club is running **The Artist's Way, VOL 002, July-September 2026**. Podyap container format is **Flowtainer v3**, run-of-show doc is **S(ho)w Flow**.

**Geyser guard:** if Geyser shows as anything but dormant while levels 1-4 have nothing scheduled in 30 days, show a warning in the boundary accent. From the voice rules: never use a Geyser to disguise an under-tended Well.

### 13.8 Monthly Rhythm frame

| Week | Activity | Behind the scenes |
|---|---|---|
| 1 | Open Studio / Drop-in | Month's content goes live |
| 2 | Open Studio / Drop-in | Workshop promo ramps, sponsor confirmed |
| 3 | **Workshop** | Core event. Depanty follows. |
| 4 | Open Studio / Drop-in | Reflect and batch next month in Cohoe |

A month missing its Week 3 Workshop renders as incomplete. Show the gap. Do not offer to fill it automatically.

Annual markers, always visible on the calendar surface: **Winter Solstice, Dec 21** = reset and reflection. **Spring Equinox, Mar 20** = emergence, Geyser territory.

### 13.9 Density and sensory settings

Persist per person, apply immediately, no save button.

- **Density** · comfortable / compact / dense
- **Motion** · full / reduced / none, defaulting to the OS `prefers-reduced-motion`
- **Water motion** · the well and geyser animations get their own off switch, separate from general motion
- **Contrast** · standard / high
- **Quiet mode** · one switch that drops all non-essential color, motion and count badges. For low-capacity days. This is the most-used setting in the product. Put it one click from anywhere.

### 13.10 Keyboard flow

Daily users do not reach for a mouse. Minimum set:

| Key | Action |
|---|---|
| `/` | Search everything |
| `d` | Drop it in |
| `g` then `w` | This Week at the Well |
| `g` then `f` | Flows |
| `g` then `p` | People |
| `g` then `m` | Moves |
| `j` / `k` | Move through a list |
| `Enter` | Open focused item |
| `Esc` | Back, close, or cancel · always, everywhere |
| `?` | Shortcut list |

Every action reachable by keyboard must show a visible focus ring. Focus order follows reading order. No focus traps.

---

## 14. What is real right now, and what is empty

Build against this, not against a hypothetical full database. Most of the product will be empty on day one. Empty is the normal state, so the empty states carry the product.

| Thing | Reality |
|---|---|
| PEOPLE | 14 rows |
| FLOWS | **3 rows. One real (Podyap Ep 1, 2026-08-21, Happened). Two entirely blank. Nothing future-dated.** |
| MOVES | 5 rows |
| MONEY | 2 rows |
| CONTENT | 2 rows |
| `CALENDAR_EVENTS`, `MILESTONES`, `STATIONS_DEFAULT`, `GUEST_JOURNEY`, `DEFAULT_ANNOUNCEMENTS` | **Empty arrays in `src/app/components/data.ts`.** Mock data was stripped and nothing replaced it. |
| Shared Google Calendar | **One upcoming event: Create Well Craft Night, Thu Sep 24 2026, 6:00-8:00 PM PDT, Café 86 Las Vegas. Setup 5:30. RSVP on Partiful, code CR8W.** |

So:

1. **The calendar is ahead of Notion.** "What is next" reads the shared calendar first and enriches from FLOWS when a matching row exists. Do not gate the next-up surface on a FLOWS row existing.
2. **RSVP is Partiful. Build no form.** Render an outbound link. No headcount sync, no rsvps table, no attendee capture UI.
3. **The two blank FLOWS rows must not render as broken cards.** A row with a null Name is not an event. Filter it out and surface the count as a data-hygiene note, not as a crash.
4. **Design the empty states as the primary state.** A dashboard with 3 flows and 5 moves has to feel calm and correct, not unfinished. "Nothing to do today" is a legitimate, complete, well-designed screen. Ship it that way.

---

## 15. Additional checks, added 2026-09-18

29. No `src/public/` directory exists anywhere in your output.
30. Dashboard home is titled "This Week at the Well" and has both a happening column and a not-ready column.
31. Lint rule fails on `funnel`, `retrospective`, `stakeholder`, `deliverable`, `CTA` in user-facing copy. Run it and paste the output.
32. Next-up surface shows Craft Night, Thu Sep 24, 6:00 PM, Café 86, with a working Partiful link, while FLOWS has no matching row.
33. The two blank FLOWS rows render nowhere. The count appears once as a hygiene note.
34. All six `TASK_ROLES` keys resolve to a person view. The facilitator union accepts all six.
35. A Flow inside its 24-72h Decomprocess window shows care copy and zero metrics. Try to reach the metrics and fail.
36. A person with blank `Consent Captured` has every outbound control disabled with a visible reason.
37. Quiet mode is reachable in one click from every screen and persists across reload.
38. Full keyboard traverse of the dashboard with a visible focus ring the whole way. No mouse.
39. The boundary accent appears only on boundaries, stop rules, consent blocks, capacity ceilings and the Decomprocess lock. Grep it and show every usage.
40. Grep for anything that sends, publishes or schedules without a click. Show that the result is empty.

---

## 16. The five breaks, as pass/fail checks. Added 2026-09-18.

Run every one. Report each as pass or fail with the evidence, not a summary.

41. `grep -n "cr8w.com" src/app/components/api.ts` returns the allowlist lines. `host.endsWith('.cr8w.com')` is present.
42. No comment anywhere in `src/` claims the Edge Function has `verify_jwt: false`.
43. `grep -rn "kv_store_" api/` returns `kv_store_dabe1c74` only. Zero occurrences of `kv_store_8dcd9693`.
44. `api/server/[[...path]].ts` is under 30 lines and contains no `createClient`, no `TABLE`, and no route handling.
45. `grep -c "createClient" api/server.ts` is 1, and no other file in `api/` constructs a Supabase client except `dashboard.ts`.
46. `grep -n "usedFallback" src/contexts/DashboardContext.tsx` shows it declared once, set in both fallback branches, and read in the `setSyncStatus` call.
47. No `setSyncStatus('fresh')` exists on any path that can be reached after a fallback.
48. `.gitignore` exists and contains `node_modules/`, `dist/`, and `.env`.
49. `npm run build` exits 0. Paste the module count and the build time.
50. Load the app with the network blocked after a first successful load. The status chip reads stale, the last-synced time is visible, and the previous data is still on screen. It does not read fresh and it does not blank out.
