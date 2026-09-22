# My Dance Comps

Mobile-first web app for Australian youth dance competitions. Built for parents and dancers aged about 2–18.

Family data (dancers, saved comps, confirmed entries, reminders, results) stays in **this browser** via `localStorage` for guests. Signing in is optional — home never requires an account. When you are logged in, that same family data also syncs to Supabase. Guest reviews of finished competitions stay on the device (`mydancecomps.reviews.v1`, keyed by competition id).

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
| `npm run test` | Filter, calendar, datetime, enrolled, scrape, reviews, client-state, account-sync, friends, copy, community chat, and dancer-account unit tests |
| `npm run scrape` | Fetch organiser calendars and merge into `src/data/comps.json` |

## Accounts, friends and Community

Email/password accounts are live. Home is not a login wall — browsing comps still works as a guest. **Log in** in the header opens the branded My Dance Comps / Mint Studio pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`). Friends need a signed-in account.

### Environment variables

Already connected via the Vercel ↔ Supabase integration. For local `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The app boots without these keys: auth pages explain that accounts are unavailable, and guest `localStorage` keeps working. `npm run build` does not require the keys.

### Run the SQL (Mitch — required in the Supabase dashboard)

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste [`supabase/migrations/20260921_family_accounts.sql`](supabase/migrations/20260921_family_accounts.sql) and run it.
3. Then paste [`supabase/migrations/20260921_kids_friends.sql`](supabase/migrations/20260921_kids_friends.sql) and run it.
4. Then paste [`supabase/migrations/20260921_community_chat.sql`](supabase/migrations/20260921_community_chat.sql) and run it.
5. Then paste [`supabase/migrations/20260922_dancer_accounts.sql`](supabase/migrations/20260922_dancer_accounts.sql) and run it. This is required for dancer logins and family codes.
6. Family accounts create `profiles`, `children`, `favourites`, `results`, `enrolled_comps`, `enrolled_by_child`, and `enrolled_child_sets` with row-level security.
7. Dancer friends create `child_friend_settings` and `child_friendships`, plus RPCs so parents can add friends by email (or invite code) and see a friend’s **enrolled** comps only (child name + comp ids — not parent email, not favourites, not date of birth).
8. Community chat creates `community_messages` with row-level security so only the two accounts on an **accepted** friendship can read or write that thread (the parent who owns the dancer, or the dancer’s own login when it is linked). It also adds the table to `supabase_realtime` so new messages can appear without a full reload. There is no public chat room.
9. Dancer accounts add `profiles.role` (`parent` or `dancer`), `profiles.family_id`, `profiles.linked_child_id`, `children.linked_user_id`, a `families` invite code, and email invites. Existing accounts stay parents. Child rows stay owned by the parent until a dancer login is linked. The file is safe to re-run.

If you previously ran an older family-accounts, friends, or community file, run all four files again, including `20260922_dancer_accounts.sql`. They are written to be safe to re-run.

### Supabase Auth settings

1. **Authentication → Providers → Email** — enable Email.
2. **Authentication → URL Configuration**
   - Site URL: production origin, e.g. `https://my-dance-comps.vercel.app`
   - Redirect URLs (add each):
     - `http://localhost:3000/reset-password`
     - `http://localhost:3000/account`
     - `http://localhost:3000/friends/join`
     - `https://my-dance-comps.vercel.app/reset-password`
     - `https://my-dance-comps.vercel.app/account`
     - `https://my-dance-comps.vercel.app/friends/join`
     - `https://*-my-dance-comps.vercel.app/reset-password`
     - `https://*-my-dance-comps.vercel.app/account`
     - `https://*-my-dance-comps.vercel.app/friends/join`
3. **Authentication → Providers → Email → Confirm email: OFF.** Leave it off. Dancer and parent sign-up must return a session straight away. The app does not turn confirmation back on.

### How accounts and friends work

1. Open the app (home loads with no login wall). Add a dancer, star a comp, tap **Enrolled**, log a result.
2. Header → **Log in** → **Sign up**. Choose **Parent** (email and password) or **Dancer** (email and password, or a username and PIN of at least 6 characters). Guest family data on that device is merged into the new account. With Confirm email off, sign-up logs you in immediately.
3. Account shows the role, counts for dancers / saved / enrolled / results, and **Family**.
4. **Parent:** create a family code (or invite a dancer by the email they will sign up with). **Dancer:** enter that code, pick “I’m this dancer” or “add me”, and the parent’s My Dancers list shows **own login**. One dancer belongs to one family. A second parent on the same family is not supported yet.
5. A signed-in dancer sees comps, My Comps, friends and Community for themselves. They do not get the household “add another dancer” controls. The parent can still mark **Enrolled** for them.
6. Sign out: the same data stays on the device (guest mode).
7. **Forgot password** works for a real email. Username logins have no mailbox, so use email for a dancer who may need a reset. While they are signed in, Account → **Change password or PIN** updates it without an email.
8. On another browser (or after clearing site data), log in: dancers, favourites, enrolled comps (family-wide and per-child) and results come back from Supabase. A linked dancer gets their own profile, not the rest of the household.
9. **Add a friend by email:** My Comps → **Friends’ comps** → parent email (or the dancer’s own email) + their dancer’s name, and which dancer the friendship is for. Or open the dancer on **My Dancers** and share an invite link/code. The other family accepts. A dancer who is logged in can accept requests for themselves.
10. When you tap **Enrolled** for a dancer, that enrolment is shared with that dancer’s friends automatically. Un-enrol removes it from their My Comps friends list. Friends only see the dancer’s name, not the parent account.
11. **Community** (bottom nav) lists accepted-friend conversations by the friend’s dancer name. Open a thread to send and receive messages. Guests see an unlock prompt to log in / add friends. Messaging is signed-in only. A linked dancer sees the threads for their own friendships.

Logged-in writes debounce (~600ms) up to Supabase. Logged-out / guest writes stay local only. Friends and Community chat are account-only — guests see unlock copy instead.

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
| `sort` | `desc` | Date order relative to today in Australia/Adelaide (`asc` default = soonest first; `desc` = latest first). Upcoming (start today or later) first, then past by most recent start. Undated last. |
| `status` | `open,closing-soon` | Registration status filter (`open`, `closing-soon`, `closed`, `opens-soon`, `unknown`). Omit for all. |

## What the app does

- **Comps** — dates, venue (name, suburb, state), registration open/close, styles, organiser, registration links. The main list defaults to the selected child’s **home state plus National finals**. Interstate events stay hidden until you turn on **Include interstate comps**. If no dancer is selected, the list uses the last-used / first child’s home state, or asks you to pick a state chip. Age (as at 1 January) and overlapping styles still apply for the selected child. Filter by entry status (open / closing soon / closed / opening / dates TBC). Sort by event date relative to **today in Australia/Adelaide** (soonest first by default: nearest upcoming start, then past by most recent; or latest first: farthest upcoming start, then past by most recent). Past comps stay in the list after upcoming ones — they are not treated as “soonest”. Finished events (end date, or start if no end, before Adelaide today) are shown with a muted mint-grey card so they read as “already been” without changing entry-status colours. Sort and status choices are stored in `localStorage`. Each card has an **Enrolled** toggle next to the favourite star. It stores a confirmed entry in the same `localStorage` family blob. If a dancer is selected, enrolment is stored for that child (`enrolledByChild`); if Everyone is selected, it uses the family-wide `enrolled` list. Tap again to un-enrol. Existing family-wide ids still show for each child until that child gets their own set. **Reviews:** finished comps (end date before today in Australia/Adelaide) show an average star rating and review count, plus a 1–5 star control and optional comment on the detail page. Guests store one review per competition in `localStorage`. Aggregates on this device only — they do not pretend other families have reviewed. A public reviews list stays stubbed until `NEXT_PUBLIC_REVIEWS_PUBLIC=1`. The `reviews` table SQL lives in [`supabase/migrations/20260921_reviews.sql`](supabase/migrations/20260921_reviews.sql).
- **My Comps** — enrolled competitions only, with an **All dancers** filter plus a chip per dancer. Cards match the main Comps list (date order, venue/address, status chips, Enrolled tagged so you can un-enrol here too) and sit first under the dancer filter. A **month calendar** below the list (same layout as the Calendar tab: status dots, enrolled stars, muted past dates) plots only those enrolled comps for the active dancer filter. Interstate enrolled comps stay visible, matching the list — there is no extra home-state hide. Months with no enrolled dates show a friendly empty state. Signed-in families also get **Friends’ comps**: read-only cards for comps a friend’s dancer has marked Enrolled, labelled with that dancer’s name only. Add a friend by parent email on the same page. Guest data stays in `localStorage`; signed-in enrolments sync and are shared with friends automatically.
- **Calendar** — month view of the same state filter as Comps (swipe or previous/next). State chips (SA, Vic, NSW, All, …) and the interstate toggle sit on the Calendar page; changing them updates the month marks immediately. A selected state shows that state’s events plus National finals; **All** / interstate-on shows every state. Dots use the same registration-status colours as the Comps chips (open / closing soon / closed / dates TBC). Dates before **today in Australia/Adelaide** use the same muted mint-grey (`past-surface`) as finished Comp cards; status dots stay. A star on a day means you tapped **Enrolled** for a competition in the current filter (for the selected dancer, or any dancer when Everyone is selected). Tap a day for the comps, status, and the same Enrolled control — finished events in that sheet are muted like the main list. Finished comps in the day sheet also show the this-device review summary.
- **My Dancers** — dancer profiles (no hard cap of two; soft max 20): name, date of birth, preferred styles, dance studio, home state. The tab and page title read **My Dancer** when there is exactly one profile. Per-dancer results log (manual). Route stays `/kids`. When signed in: **Friends** (share invite, add by parent email, accept/decline, remove). Friendship is between dancers; parents stay in control.
- **Community** — friends-only chat between signed-in parents who have an accepted dancer friendship. The list shows the friend’s dancer name (and which of your dancers the friendship is for). Guests get a log-in / sign-up unlock. There is no public room for strangers. Favourite stars on Comp cards still work; `/saved` redirects home.
- **Account** — email/password. Header **Log in** when signed out, **Account** when signed in. Guest browsing stays available.
- **Reminders** — prefs for entries open, 1 week before close, and 1 day before close. In-app list for starred (favourite) comps, `.ics` download, `mailto` list, and browser notifications when the browser allows them (no paid API keys).

## Seed data and daily scrape

Listings live in [`src/data/comps.json`](src/data/comps.json). Seed rows cover SASDS, Dance Competitions SA, Evolution Dance Comp, Count Me In (CMIDC), **Full Out** ([fullout.com.au](https://fullout.com.au) only — not the US Full Out Dance Production site), Follow Your Dreams, Carnival, Dance Hub Australia calendars, and other published 2026 dates. The UI always has this file even if a live scrape cannot reach organiser sites.

Sources live in [`src/data/sources.json`](src/data/sources.json). Last automated run is recorded in [`src/data/scrape-status.json`](src/data/scrape-status.json).

Daily refresh is automatic after you import the repo on Vercel **and** leave GitHub Actions on. Manual run:

```bash
npm run scrape
```

The scraper (`src/lib/scrape.ts`, CLI in `scripts/scrape.ts`) fetches each source, parses what it can, and **merges** into `comps.json`. Existing seed rows are never deleted. Each scrape records `lastFetchedAt` (same ISO timestamp as `lastRunAt`, Australia/Adelaide timezone context) in [`src/data/scrape-status.json`](src/data/scrape-status.json).

**Full Out (Australia)** uses [fullout.com.au](https://fullout.com.au) only — not the US Full Out Dance Production site. Daily scrape reads the enter cards at [fullout.com.au/enter/](https://fullout.com.au/enter/) (robots.txt allows fetches). Tour dates are also published as an image at [fullout.com.au/tour-dates/](https://fullout.com.au/tour-dates/). Styles come from [fullout.com.au/rules-dance/](https://fullout.com.au/rules-dance/). CompHQ registration links that appear on the enter page are stored as `registrationUrl`. Waitlist: dance@fullout.com.au. If the HTML is flaky, seed rows in `comps.json` still show in the UI.

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
   - `full-out` — Full Out Australia enter cards ([fullout.com.au](https://fullout.com.au) only)
   - `dance-hub-table` — Dance Hub Australia HTML tables
   - `html-generic` — best-effort date sniffing
   - `seed-only` — skip live fetch

3. For a new HTML shape, add a `parse…` function and map it in the `parsers` object.

4. Run `npm run scrape`, check the diff, adjust the parser, then commit `src/data/comps.json`.

## Age rule

Competition age is **as at 1 January** of the competition year. A dancer born 15 June 2018 is 7 on 1 January 2026.

## Privacy

Guests: dancers, saved comps, confirmed entries (`enrolled` / `enrolledByChild`), results, and reviews stay on the device in `localStorage`. They never leave the browser unless you export a calendar, email a reminder list, or **choose** to create an account. Confirmed entries live in `mydancecomps.family.v1`. Reviews use `mydancecomps.reviews.v1`.

Signed-in families: dancers, saved comps, enrolled comps (family-wide and per-child) and results sync to your Supabase project under row-level security. A dancer login reads and updates only their linked profile, enrolments and results; favourites on that login stay theirs. Friends only see a dancer’s **name** and the comps that dancer is enrolled in — not the parent email, not favourites, not date of birth. Community messages are stored in Supabase and are readable only by the accounts on that accepted friendship (the parent who owns the profile, and the dancer when their login is linked). Either side can remove the friend, or turn off sharing enrolled comps, at any time. Passwords and PINs are handled by Supabase Auth, not stored in this app. Username logins use an internal address at `dancers.mydancecomps.app` so they can sign in without a mailbox while Confirm email is off.
