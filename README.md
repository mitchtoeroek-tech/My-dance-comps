# My Dance Comps

Mobile-first web app for Australian youth dance competitions. Built for parents and dancers aged about 2–18.

Family data (kids, saved comps, reminders, results) stays in **this browser** via `localStorage`. Competition listings ship as seed data so the UI works even when a scrape cannot reach organiser sites.

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
| `npm run test` | Home-state / interstate filter and client-state unit tests |
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

## What the app does

- **Comps** — dates, registration open/close, styles, organiser, registration links. The main list defaults to the selected child’s **home state plus National finals**. Interstate events stay hidden until you turn on **Include interstate comps**. If no dancer is selected, the list uses the last-used / first child’s home state, or asks you to pick a state chip. Age (as at 1 January) and overlapping styles still apply for the selected child.
- **Kids** — multiple child profiles (no hard cap of two; soft max 20): name, date of birth, preferred styles, dance studio, home state. Per-child results log (manual).
- **Saved** — favourite comps, persisted in `localStorage`.
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

No accounts, no backend database, no secrets. Kids and results never leave the device unless you export a calendar or email the reminder list yourself.
