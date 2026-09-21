# My Dance Comps

Mobile-first web app for Australian youth dance competitions. Built for parents and dancers aged about 2–18.

Family data (kids, saved comps, enrolled comps, reminders, results) stays in **this browser** via `localStorage` for guests. Signing in is optional — home never requires an account. When you are logged in, that same family data also syncs to Supabase.

Competition listings ship as seed data so the UI works even when a scrape cannot reach organiser sites.

Times that matter (entry open/close, reminders, calendar files) use **Australia/Adelaide**. Copy is **en-AU**.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (what Vercel runs) |
| `npm start` | Serve the production build |
| `npm run test` | Filter, client-state, and account-sync unit tests |
| `npm run scrape` | Fetch organiser calendars and merge into `src/data/comps.json` |

## Accounts (optional)

Guest mode is the default. Parents can use the live app tonight without creating an account. **Account** in the header is optional.

Email/password auth uses `@supabase/supabase-js` and the official My Dance Comps / Mint Studio branding (not the generic Supabase widget).

### Environment variables

Already connected via the Vercel ↔ Supabase integration. For local `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The app boots without these keys: auth pages explain that accounts are unavailable, and guest `localStorage` keeps working. `npm run build` does not require the keys.

### Run the SQL migration

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste [`supabase/migrations/20260921_family_accounts.sql`](supabase/migrations/20260921_family_accounts.sql) and run it.
3. Then paste [`supabase/migrations/20260921_kids_friends.sql`](supabase/migrations/20260921_kids_friends.sql) and run it.
4. Family accounts create `profiles`, `children`, `favourites`, `results`, and `enrolled_comps` with row-level security (users only see their own rows).
5. Kids friends create `child_friend_settings` and `child_friendships`, plus RPCs so parents can search/invite and see a friend’s **enrolled** comps only (not favourites, not date of birth).

### Supabase Auth settings

1. **Authentication → Providers → Email** — enable Email.
2. **Authentication → URL Configuration**
   - Site URL: production origin, e.g. `https://my-dance-comps.vercel.app`
   - Redirect URLs (add each):
     - `http://localhost:3000/reset-password`
     - `http://localhost:3000/account`
     - `https://my-dance-comps.vercel.app/reset-password`
     - `https://my-dance-comps.vercel.app/account`
     - `https://*-my-dance-comps.vercel.app/reset-password`
     - `https://*-my-dance-comps.vercel.app/account`
3. Optional: turn off **Confirm email** while testing so sign-up logs in immediately. Leave it on for production if you want confirmation emails.

### How to test auth

1. Open the app as a guest (home must load with no login wall). Add a kid, star a comp, tap **Mark as entered**, log a result.
2. Header → **Account** → **Sign up** with a real inbox you can open.
3. Confirm the email if required, then **Log in**.
4. Account should show counts for kids / saved / entered / results. Sign out: the same data stays on the device (guest mode).
5. **Forgot password** → use the email link → **Reset password** on the branded page.
6. On another browser (or after clearing site data), log in: kids, favourites, enrolled comps and results should come back from Supabase.
7. Open a dancer on **Kids**. Share the invite (one tap), or add a friend by code / parent email + child name. Accept on the other account. **My comps** shows that friend’s entered comps, read-only.

Logged-in writes debounce (~600ms) up to Supabase. Logged-out / guest writes stay local only. Friends are account-only — guests see “Friends unlock when you sign in”.

## Deploy on Vercel

Import this GitHub repo (`main`). Guest mode needs **no** environment variables. Accounts need:

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel ↔ Supabase integration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel ↔ Supabase integration |

Listings refresh themselves every day:

1. **GitHub Action** (`.github/workflows/daily-scrape.yml`) runs about 6am Adelaide time, rechecks the organiser websites, and commits any changes to `src/data/comps.json`. Vercel then redeploys `main`.
2. **Vercel Cron** (`/api/cron/refresh` at 20:30 UTC) scrapes the same sources into the app cache so the live API can pick up updates even between deploys.

You can also run **Actions → Daily competition scrape → Run workflow** to refresh immediately. GitHub Actions must be enabled on the repo (the default).

## API

- `GET /api/comps` — full competition list (optional filters below)
- `GET /api/comps/:id` — one competition
- `GET /api/sources` — scrape sources
- `GET /api/ics?compId=<id>` — calendar file for one comp
- `GET /api/ics?saved=id1,id2` — reminder calendar for saved ids

Query params for `/api/comps`:

| Param | Example | Meaning |
| --- | --- | --- |
| `q` | `jazz` | Search name, suburb, style, organiser |
| `dob` | `2018-06-15` | Child date of birth (age as at 1 January of the comp year) |
| `state` | `SA` | Home state. Filters to that state + nationals (even without `dob`). |
| `styles` | `Jazz,Tap` | Preferred styles (overlap) |
| `interstate` | `1` | Include other states when a home `state` (or child `dob`+`state`) is applied |
| `saved` | `id,id` | Limit to favourite ids |
| `sort` | `desc` | Date order (`asc` default = soonest first; `desc` = latest first). Sorts by start date, then end date, then registration dates. |
| `status` | `open,closing-soon` | Registration status filter (`open`, `closing-soon`, `closed`, `opens-soon`, `unknown`). Omit for all. |

## What the app does

- **Comps** — dates, venue (name, suburb, state), registration open/close, styles, organiser, registration links. The main list defaults to the selected child’s **home state plus National finals**. Interstate events stay hidden until you turn on **Include interstate comps**. If no dancer is selected, the list uses the last-used / first child’s home state, or asks you to pick a state chip. Age (as at 1 January) and overlapping styles still apply for the selected child. Filter by entry status (open / closing soon / closed / opening / dates TBC). Sort by event date (soonest first by default, or latest first). Sort and status choices are stored in `localStorage`.
- **Kids** — multiple child profiles (no hard cap of two; soft max 20): name, date of birth, preferred styles, dance studio, home state. Per-child results log (manual). When signed in: **Friends** (invite link/code, search, accept/decline, remove). Friendship is between dancers; parents stay in control.
- **My comps** — favourite comps, plus comps marked as entered, plus friends’ entered comps (read-only, same card style and date order). Favourites stay in `localStorage` (and sync when signed in). **Mark as entered** stores a family-wide enrolled list the same way.
- **Account** — optional email/password. Guest remains the default. Friends stay locked until you sign in.
- **Reminders** — prefs for entries open, 1 week before close, and 1 day before close. In-app list for saved comps, `.ics` download, `mailto` list, and browser notifications when the browser allows them (no paid API keys).

## Seed data and daily scrape

Listings live in [`src/data/comps.json`](src/data/comps.json). Seed rows cover SASDS, Dance Competitions SA, Evolution Dance Comp, Count Me In (CMIDC), Follow Your Dreams, Carnival, Dance Hub Australia calendars, and other published 2026 dates. The UI always has this file even if a live scrape cannot reach organiser sites.

Sources live in [`src/data/sources.json`](src/data/sources.json). Last automated run is recorded in [`src/data/scrape-status.json`](src/data/scrape-status.json).

Daily refresh is automatic after you import the repo on Vercel **and** leave GitHub Actions on. Manual run:

```bash
npm run scrape
```

The scraper (`src/lib/scrape.ts`, CLI in `scripts/scrape.ts`) fetches each source, parses what it can, and **merges** into `comps.json`. Existing seed rows are never deleted.

Organiser websites change layout without notice. Treat scrape output as a hint and confirm on the official registration page before you enter.

### Add a source

1. Append an object to `src/data/sources.json`:

```json
{
  "id": "my-comp",
  "name": "My Comp Series",
  "url": "https://example.com",
  "scrapeUrl": "https://example.com/dates",
  "parser": "html-generic",
  "notes": "What this calendar covers",
  "region": "SA"
}
```

2. Parsers already in `src/lib/scrape.ts`:

   - `sasds` — SASDS information page
   - `evolution` — Evolution regionals table
   - `cmidc` — Count Me In dates
   - `dance-hub-table` — Dance Hub Australia HTML tables
   - `html-generic` — best-effort date sniffing
   - `seed-only` — skip live fetch

3. For a new HTML shape, add a `parse…` function and map it in the `parsers` object.

4. Run `npm run scrape`, check the diff, adjust the parser, then commit `src/data/comps.json`.

## Age rule

Competition age is **as at 1 January** of the competition year. A dancer born 15 June 2018 is 7 on 1 January 2026.

## Privacy

Guests: kids, saved comps, enrolled comps and results stay on the device in `localStorage`. They never leave the browser unless you export a calendar, email a reminder list, or **choose** to create an account. Friends stay locked with “Friends unlock when you sign in”.

Signed-in families: the same records sync to your Supabase project under row-level security. Passwords are handled by Supabase Auth, not stored in this app.

Friends: friendship is between child profiles. The other parent only sees the dancer’s name and comps marked as entered. Favourites and date of birth are not shared. Either parent can remove the friend, or turn off sharing entered comps, at any time.

## Kids friends (accounts branch)

Friends ships with optional accounts. Do not merge this to `main` until you are ready to turn login on.

To go live later:

1. Keep production on `main` (guest-friendly) until parents have finished testing.
2. Run both SQL files in the Supabase SQL editor (family accounts, then kids friends).
3. Confirm Vercel has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Merge the accounts PR, then the friends PR stacked on it (or merge friends into the accounts branch first, then merge that to `main` in one go).
5. Smoke-test: two parent accounts, share invite, accept, confirm friend’s entered comps show as read-only cards on **My comps**.
