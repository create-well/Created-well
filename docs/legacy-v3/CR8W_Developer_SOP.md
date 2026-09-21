# CR8W Dashboard — Developer & Operations SOP

**For:** Monica Blanco (Monny) and future Create Well dev team
**Last updated:** August 2026
**Applies to:** https://cr8w.com

---

## 1. Quick Reference (Bookmark These)

| What | URL | Password / Token |
|------|-----|-----------------|
| **Live Dashboard** | https://cr8w.com | Profile: `monny` / `sunshine` / `bingle` / `omar` / `pia` |
| **Vercel Dashboard** | https://vercel.com/monnylog/cr8w_home_v2 | Google login (monica.istorya@gmail.com) |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/axntibrdivccycxdwlzk | Google login |
| **Notion Workspace** | https://www.notion.so/hello-takehome-studio | hello@takehome.studio |
| **GitHub Repo** | https://github.com/create-well/CR8W_home_v3 | — |
| **Google Drive** | https://drive.google.com/drive/folders/1d9OyYZusS0yyYsfwtjLkz1ss0KYPzl5a | monica.istorya@gmail.com |

**Important tokens (DO NOT share outside core team):**
- Notion integration token: `REDACTED_SEE_VERCEL_ENV`
- Supabase project ref: `axntibrdivccycxdwlzk`
- Vercel project ID: `prj_KMc00vxHpX0v9rbP87p031ruwZIK`

---

## 2. How to Access the Dashboard

1. Open https://cr8w.com in any browser
2. Click your profile name:
   - `monny` → full core access
   - `sunshine` → full core access
   - `bingle` → full core access
   - `omar` → full core access
   - `pia` → co-creator access (Hub, Workshops, Well only)
3. That's it. No password. The dashboard loads your role automatically from Supabase.

---

## 3. How to Trigger a Notion Sync

### Option A: Click the button (easiest)
1. Open https://cr8w.com
2. Click the **🔄 Sync** button in the top-right nav bar (between 💬 and the green dot)
3. Wait ~5-10 seconds
4. The sync dot turns green = success, red = error

### Option B: Let it run automatically
- Sync runs every ~30 minutes automatically (cron job on Supabase)
- The sync dot in the nav shows the last sync time on hover

### Option C: Run manually via command line
```bash
curl -X POST 'https://axntibrdivccycxdwlzk.supabase.co/functions/v1/sync-to-notion' \
  -H 'Content-Type: application/json' -d '{}'

curl -X POST 'https://axntibrdivccycxdwlzk.supabase.co/functions/v1/sync-from-notion' \
  -H 'Content-Type: application/json' -d '{}'
```

---

## 4. How to Update the Dashboard (For Beginners)

### If you need to change text, colors, or layout:

**Step 1 — Open the code**
```bash
# On Monica's Mac, the project lives here:
cd /Users/monicablanco/Desktop/createwell/CR8W_home_v3
```

**Step 2 — Edit the file you need**
| To change... | Edit this file... |
|-------------|-------------------|
| Nav bar text, sync button, profile dropdown | `src/components/TopNav.tsx` |
| Which views exist and their order | `src/App.tsx` (lines 24-32) |
| Hub page layout | `src/views/HubView.tsx` |
| Podcast page | `src/views/PodcastView.tsx` |
| Workshops + applicants | `src/views/WorkshopsView.tsx` |
| The Well (forum + notes) | `src/views/WellView.tsx` |
| CoFlow check-ins | `src/views/CoFlowView.tsx` |
| Team / collaborators | `src/views/TeamView.tsx` |
| Revenue pipeline | `src/views/RevenueView.tsx` |
| Colors, fonts, spacing | `src/index.css` (design tokens at top) |
| API calls to backend | `src/api.ts` |

**Step 3 — Build to check for errors**
```bash
cd /Users/monicablanco/Desktop/createwell/CR8W_home_v3
npm run build
```
If it says "✓ built in Xms" — you're good.
If it shows errors — read the error message, fix the file, try again.

**Step 4 — Deploy**
```bash
npx vercel@latest --prod --yes
```
Wait ~20 seconds. The URL https://cr8w.com updates automatically.

---

## 5. How to Access the Supabase Backend (Database)

### Option A: Web Dashboard (easiest, visual)
1. Go to https://supabase.com/dashboard/project/axntibrdivccycxdwlzk
2. Log in with Google (monica.istorya@gmail.com)
3. Use the left sidebar:
   - **Table Editor** → browse/edit data like a spreadsheet
   - **SQL Editor** → run custom queries
   - **Database** → view tables, relationships, RLS policies
   - **Edge Functions** → view/deploy serverless functions
   - **Logs** → see what happened, debug errors

### Option B: SQL Editor (for quick changes)
1. In Supabase dashboard → SQL Editor
2. Write your query, click Run
3. Examples:

```sql
-- View all podcast episodes
SELECT * FROM episodes ORDER BY episode_num;

-- View all workshops
SELECT * FROM workshops ORDER BY date;

-- View revenue opportunities
SELECT * FROM revenue_ops ORDER BY expected_close;

-- Check who has access
SELECT username, role FROM profiles;
```

### Option C: Edge Functions (for code-level backend changes)
1. In Supabase dashboard → Edge Functions
2. See the list: `sync-to-notion`, `sync-from-notion`
3. Click one to view its code
4. To edit: download, modify, then redeploy (see Section 7)

---

## 6. Notion Databases — What Lives Where

The dashboard syncs bidirectionally with these Notion databases in the `hello@takehome.studio` workspace:

| Notion Database | Supabase Table | What it holds |
|----------------|----------------|---------------|
| CR8W Podcast Episodes | `episodes` | Episode topics, guests, status, dates |
| CR8W Guests | `guests` | Guest names, contact, stage, prep notes |
| CR8W Topic Drops | `topic_drops` | Ideas for podcast topics, votes, gut checks |
| CR8W Workshops | `workshops` | Workshop titles, dates, facilitators, status |
| CR8W Applicants | `applicants` | Workshop applicants, vetting stage, source |
| CR8W Revenue Opportunities | `revenue_ops` | Sponsors, grants, donors, pipeline stage |
| CR8W CoFlow Check-ins | `coflow_checkins` | Weekly check-in data for meetings |

**How to edit in Notion:**
1. Open https://www.notion.so
2. Log in as hello@takehome.studio
3. Find the relevant database
4. Edit cells like a spreadsheet
5. The next auto-sync (or manual 🔄 click) pushes changes to the dashboard

---

## 7. How to Deploy / Update Edge Functions

Edge Functions are the serverless code that runs on Supabase (like the Notion sync).

**Step 1 — Edit the function**
```bash
# Function files live here:
cd /Users/monicablanco/Desktop/createwell/CR8W_home_v3/supabase/functions/sync-to-notion
# or
supabase/functions/sync-from-notion
```

**Step 2 — Deploy**
```bash
# Using Supabase CLI (if installed)
supabase functions deploy sync-to-notion
supabase functions deploy sync-from-notion

# Or using the MCP / dashboard:
# Go to Supabase Dashboard → Edge Functions → Deploy
```

**Verify deployment:**
```bash
curl -X POST 'https://axntibrdivccycxdwlzk.supabase.co/functions/v1/sync-to-notion' \
  -H 'Content-Type: application/json' -d '{}'
```
Should return `{ok: true, results: [...]}`

---

## 8. Local Development — Full Setup (For New Dev)

**Prerequisites:**
- Node.js 20+ (`node --version`)
- npm (comes with Node)
- Git (for cloning)

**Setup:**
```bash
# 1. Clone the repo
git clone https://github.com/create-well/CR8W_home_v3.git
cd CR8W_home_v3

# 2. Install dependencies
npm install

# 3. Create local env file
cp .env.example .env.local
# Edit .env.local with:
# VITE_SUPABASE_URL=https://axntibrdivccycxdwlzk.supabase.co
# VITE_SUPABASE_ANON_KEY=<get from Supabase dashboard → Project Settings → API>

# 4. Start dev server
npm run dev
# Opens at http://localhost:3000

# 5. Build for production check
npm run build
```

---

## 9. CRITICAL: Do Not Edit These Files

| File | Why |
|------|-----|
| `src/utils/supabase/info.tsx` | Auto-generated by Figma Make. Editing it will be overwritten on every sync. Use `config.ts` instead. |
| `node_modules/` | Auto-generated. Never commit. |
| `dist/` | Auto-generated build output. Never commit. |
| Edge Function secrets (DB IDs, tokens) | Stored in Supabase Vault, NOT in code. Access via `public.get_notion_secrets()` RPC. |

---

## 10. Troubleshooting

### Problem: Dashboard won't load / shows "Loading the well..." forever
**Fix:** Check your internet. The dashboard needs to reach Supabase. Try refreshing.

### Problem: Sync button shows red dot / "error"
**Fix:**
1. Check Supabase status: https://status.supabase.com
2. Try the manual curl command (Section 3, Option C)
3. Check Supabase Logs: Dashboard → Logs → Edge Functions

### Problem: Changes I made in Notion don't show in dashboard
**Fix:**
1. Click 🔄 Sync button on dashboard
2. Wait 10 seconds
3. If still missing, check the Notion database name matches exactly

### Problem: `npm run build` fails
**Fix:**
1. Read the error message carefully — it tells you the file and line
2. Common causes: missing closing tag, typo in variable name, forgot `async` keyword
3. If stuck, run `git diff` to see what changed

### Problem: Figma Make sync broke the build
**Fix:**
1. `git diff --name-only` — see what Figma Make touched
2. Check if `.gitignore` is missing — restore it
3. Check if `src/utils/supabase/config.ts` is missing — recreate from `info.tsx`
4. Fix imports in `src/api.ts` and `src/App.tsx`
5. `npm run build` to verify

---

## 11. Team Design Reminders

This dashboard serves humans first. When building:

- **Sunshine** needs vision seen, not hustle metrics
- **Monny** needs bridge-building tools, not output tracking
- **Bingle** needs explicit sight recognition — don't make them invisible
- **Omar** needs container held — when gear won't flow, go audio-only

The dashboard is a **flow tool**, not a surveillance tool. Build banks for the river. Don't force the architecture.

---

## 12. Emergency Contacts

| What | Who / Where |
|------|------------|
| Can't access dashboard | Omar (Tech Anchor) or check Vercel status |
| Notion sync broken | Check Supabase logs first, then ping Omar |
| Need new team member access | Add profile to `profiles` table in Supabase, set role |
| Lost Notion token | Regenerate at notion.so → Integrations → CR8W |
| GitHub repo access | Repo owner: create-well org |

---

*This document lives in the workspace at:*
`/Users/monicablanco/Desktop/createwell/CR8W_home_v3/CR8W_Developer_SOP.md`

*And in the repo at:*
https://github.com/create-well/CR8W_home_v3/blob/main/CR8W_Developer_SOP.md
