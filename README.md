# My Dance Comps

Mobile-first web app for Australian youth dance competitions. Built for parents and dancers aged about 2–18.

Family data (kids, saved comps, confirmed entries, reminders, results) stays in **this browser** via `localStorage`. Guest reviews of finished competitions are stored the same way (`mydancecomps.reviews.v1`, keyed by competition id). Competition listings ship as seed data so the UI works even when a scrape cannot reach organiser sites.

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
| `npm run test` | Home-state / interstate filter, calendar, datetime, enrolled, scrape, reviews, and client-state unit tests |
| `npm run scrape` | Fetch organiser calendars and merge into `src/data/comps.json` |

## Deploy on Vercel

Import this GitHub repo (`main`). No environment variables or secrets are required.

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

- **Comps** — dates, venue (name, suburb, state), registration open/close, styles, organiser, registration links. The main list defaults to the selected child’s **home state plus National finals**. Interstate events stay hidden until you turn on **Include interstate comps**. If no dancer is selected, the list uses the last-used / first child’s home state, or asks you to pick a state chip. Age (as at 1 January) and overlapping styles still apply for the selected child. Filter by entry status (open / closing soon / closed / opening / dates TBC). Sort by event date relative to **today in Australia/Adelaide** (soonest first by default: nearest upcoming start, then past by most recent; or latest first: farthest upcoming start, then past by most recent). Past comps stay in the list after upcoming ones — they are not treated as “soonest”. Finished events (end date, or start if no end, before Adelaide today) are shown with a muted mint-grey card so they read as “already been” without changing entry-status colours. Sort and status choices are stored in `localStorage`. Each card has an **Enrolled** toggle next to the favourite star. It stores a confirmed entry in the same `localStorage` family blob. If a dancer is selected, enrolment is stored for that child (`enrolledByChild`); if Everyone is selected, it uses the family-wide `enrolled` list. Tap again to un-enrol. Existing family-wide ids still show for each child until that child gets their own set. **Reviews:** finished comps (end date before today in Australia/Adelaide) show an average star rating and review count, plus a 1–5 star control and optional comment on the detail page. Guests store one review per competition in `localStorage`. Aggregates on main are this device only — they do not pretend other families have reviewed. A public reviews list is stubbed with “Public reviews unlock when accounts go live”. The `reviews` table SQL and persist stub live in [`supabase/migrations/20260921_reviews.sql`](supabase/migrations/20260921_reviews.sql) and [`src/lib/reviews-backend.ts`](src/lib/reviews-backend.ts); they stay unused until accounts (held-off PR #8) ship. Do not set `NEXT_PUBLIC_REVIEWS_PUBLIC=1` on main.
- **My Comps** — enrolled competitions only, with an **All children** filter plus a chip per dancer. Cards match the main Comps list (date order, venue/address, status chips, Enrolled tagged so you can un-enrol here too). Guest data stays in `localStorage`.
- **Calendar** — month view of the same state filter as Comps (swipe or previous/next). State chips (SA, Vic, NSW, All, …) and the interstate toggle sit on the Calendar page; changing them updates the month marks immediately. A selected state shows that state’s events plus National finals; **All** / interstate-on shows every state. Dots use the same registration-status colours as the Comps chips (open / closing soon / closed / dates TBC). Dates before **today in Australia/Adelaide** use the same muted mint-grey (`past-surface`) as finished Comp cards; status dots stay. A star on a day means you tapped **Enrolled** for a competition in the current filter (for the selected dancer, or any dancer when Everyone is selected). Tap a day for the comps, status, and the same Enrolled control — finished events in that sheet are muted like the main list. Finished comps in the day sheet also show the this-device review summary.
- **Kids** — multiple child profiles (no hard cap of two; soft max 20): name, date of birth, preferred styles, dance studio, home state. Per-child results log (manual).
- **Saved** — favourite comps, persisted in `localStorage`.
- **Reminders** — prefs for entries open, 1 week before close, and 1 day before close. In-app list for saved comps, `.ics` download, `mailto` list, and browser notifications when the browser allows them (no paid API keys).

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

No accounts, no backend database, no secrets. Kids, saved comps, confirmed entries (`enrolled` / `enrolledByChild`), results, and guest reviews never leave the device unless you export a calendar or email the reminder list yourself. Confirmed entries live in the same `localStorage` key as the rest of the family state (`mydancecomps.family.v1`): family-wide `enrolled` competition ids, plus optional per-child `enrolledByChild`. Reviews use a separate key (`mydancecomps.reviews.v1`) so they can later map to a public `reviews` table without merging login early.
