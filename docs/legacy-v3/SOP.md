# CR8W Dashboard — Developer & Team Access SOP

> Last updated: 2026-08-10
> For: Monica + future dev team
> Status: Living document

---

## Quick Links

| Resource | URL | Notes |
|----------|-----|-------|
| **Live Dashboard** | https://cr8w.com | Password: `monnytinks` |
| **GitHub Repo** | https://github.com/create-well/CR8W_home_v3 | Main branch auto-deploys |
| **Vercel Project** | https://vercel.com/create-well/cr8whomev2 | Deploy logs + env vars |
| **Supabase Project** | https://supabase.com/dashboard/project/axntibrdivccycxdwlzk | DB, Auth, Realtime |
| **Workspace** | `~/Desktop/createwell/CR8W_home_v3` | Local dev folder |

---

## 1. First-Time Setup (New Dev)

### 1.1 Clone the repo

```bash
cd ~/Desktop/createwell
git clone https://github.com/create-well/CR8W_home_v3.git
cd CR8W_home_v3
npm install
```

### 1.2 Environment variables

Copy `.env.example` to `.env` (or ask Monny/Omar for the current `.env`):

```bash
VITE_SUPABASE_URL=https://axntibrdivccycxdwlzk.supabase.co
VITE_SUPABASE_ANON_KEY=<ask Omar for the publishable key>
```

> **Do NOT commit `.env`** — it's already in `.gitignore`.

### 1.3 Run locally

```bash
npm run dev
# Opens at http://localhost:3000
```

### 1.4 Verify build

```bash
npm run build
npm run preview
```

---

## 2. Deploy to Production

```bash
cd ~/Desktop/createwell/CR8W_home_v3

# 1. Check what changed
git status
git diff

# 2. Commit
git add -A
git commit -m "feat: describe what you built"

# 3. Push (triggers Vercel auto-deploy)
git push origin main

# 4. Force deploy if needed
npx vercel --prod
```

> Vercel auto-deploys on every push to `main`. The `--prod` flag is only needed if you want to force a redeploy.

---

## 3. Supabase — Database & Realtime

### 3.1 Access the dashboard

Go to: https://supabase.com/dashboard/project/axntibrdivccycxdwlzk

Login with the team Google account (ask Monny for access).

### 3.2 Key tables

| Table | Purpose | Live-synced in UI? |
|-------|---------|-------------------|
| `workshops` | Scheduled events | ✅ Workshops view |
| `applicants` | Workshop applications | ✅ Pipeline kanban |
| `workshop_feedback` | Post-event data | ✅ Feedback tab |
| `episodes` | Podcast episodes | ✅ Podcast pipeline |
| `guests` | Podcast guests | ✅ Guest flow |
| `topic_drops` | Topic well ideas | ✅ Topic Well |
| `coflow_checkins` | Pre-meeting body checks | ✅ CoFlow view |
| `revenue_ops` | Sponsorship/funding leads | ✅ Revenue view |
| `profiles` | Team & collaborators | ✅ Auth + Team view |

### 3.3 Adding a new table

1. Go to **Table Editor** → **New table**
2. Or use SQL Editor:

```sql
create table public.my_new_table (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.my_new_table enable row level security;

-- Allow authenticated access
CREATE POLICY "Allow authenticated all" ON public.my_new_table
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

3. Create a real-time hook in `src/hooks/useMyNewTableRealtime.ts`
4. Wire it into `App.tsx`

### 3.4 Real-time subscriptions

The dashboard uses Supabase's `postgres_changes` for live sync. When any user edits data, all open dashboards update within seconds.

**Pattern:**
```typescript
const channel = supabase
  .channel('table-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'my_table' }, () => fetchAll())
  .subscribe();
```

---

## 4. Common Tasks

### 4.1 Add a new dashboard view

1. Create `src/views/MyView.tsx`
2. Add the view key to `type View` in `App.tsx`
3. Add to `ALL_VIEWS` array
4. Add to `viewsForRole()` function
5. Add the route in the `currentView === 'myview'` block
6. Add nav link in `TopNav.tsx` (if not auto-generated from `ALL_VIEWS`)

### 4.2 Update the logo

The wordmark lives in `public/create-well-wordmark.png`.

1. Replace the PNG file
2. It's referenced in:
   - `src/components/TopNav.tsx` (height: 28px)
   - `src/components/AuthGate.tsx` (height: 40px)
3. Commit + push

### 4.3 Update brand colors

Colors are CSS custom properties in `src/styles/design-tokens.css`:

```css
:root {
  --rust: #C25B38;
  --clay: #E8AF93;
  --camel: #D4A771;
  --sandstone: #EAE3DB;
  --cream: #F4EAE0;
  --charcoal: #3A3A3A;
}
```

### 4.4 Add a new team member

1. Add to `PROFILES` array in `src/components/AuthGate.tsx`
2. Add to `PROFILE_KEY_TO_USERNAME` in `src/App.tsx`
3. Add their row to the `profiles` table in Supabase:

```sql
INSERT INTO profiles (username, name, role, hd_type)
VALUES ('newperson', 'New Person', 'co-creator', 'Generator 5/1');
```

### 4.5 Change access roles

Edit `getDefaultRole()` and `viewsForRole()` in `src/App.tsx`:

```typescript
function viewsForRole(role: Role): View[] {
  if (role === 'core') return ['hub', 'podcast', 'workshops', 'well', 'coflow', 'team', 'revenue'];
  if (role === 'co-creator') return ['hub', 'workshops', 'well'];
  return ['hub'];
}
```

---

## 5. Troubleshooting

### Build fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Supabase connection errors

- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Verify the project is not paused in Supabase dashboard
- Check RLS policies if reads return empty

### Real-time not working

- Check browser console for WebSocket errors
- Verify the table has `enable row level security` + policies
- Check that the channel name is unique per table

### Vercel deploy fails

```bash
# Check logs
npx vercel --logs

# Redeploy
npx vercel --prod
```

---

## 6. Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Vercel CDN │────▶│  React App  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    │
               ┌────▼────┐     ┌──────────┐
               │Supabase │◄────│ Realtime │
               │  (DB)   │     │  (WS)    │
               └────┬────┘     └──────────┘
                    │
               ┌────▼────┐
               │  Auth   │
               └─────────┘
```

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Hosting:** Vercel (static site, edge CDN)
- **State:** React hooks + Supabase real-time subscriptions
- **No custom backend server** — all CRUD goes directly to Supabase

---

## 7. Contact & Escalation

| Issue | Who | How |
|-------|-----|-----|
| Code / deploy | Omar | GitHub / iMessage |
| Design / brand | Monny | iMessage |
| Access / passwords | Monny | iMessage |
| Supabase admin | Omar | Supabase dashboard |
| Vercel billing | Monny | Vercel dashboard |

---

## 8. Glossary

| Term | Meaning |
|------|---------|
| **BHD** | Big Human Design — team decision-making meetings |
| **CoFlow** | Pre-meeting body check-in protocol |
| **Drop** | An idea tossed into the Topic Well |
| **Eppy** | Podcast episode |
| **Flow Keeper** | Episode facilitator role |
| **Somatic** | Body-based awareness (jaw clench, breath, etc.) |
| **The Well** | Collective idea repository |

---

*This doc lives in `~/Desktop/createwell/CR8W_home_v3/SOP.md` and should be updated as the system evolves.*
