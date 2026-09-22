# My Dance Comps

Mobile-first web app for Australian youth dance competitions. Built for parents and dancers aged about 2–18.

Family data (dancers, confirmed entries, reminders, results) stays in **this browser** via `localStorage` for guests. Signing in is optional — home never requires an account. When you are logged in, that same family data also syncs to Supabase. Guest reviews of finished competitions stay on the device (`mydancecomps.reviews.v1`, keyed by competition id).

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
| `npm run test` | Filter, calendar, datetime, enrolled, scrape, reviews, client-state, account-sync, friends, copy, community chat, dancer-account, and studio-account unit tests |
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
6. Then paste [`supabase/migrations/20260922_studio_accounts.sql`](supabase/migrations/20260922_studio_accounts.sql) and run it. This is required for studio sign-up, approval, logos and linking. If you re-run an older SQL file, run the studio file again afterwards.
7. Then paste [`supabase/migrations/20260922_studio_community_chat.sql`](supabase/migrations/20260922_studio_community_chat.sql) and run it. This adds open studio chat. It does not change friend chat or email confirmation. Safe to re-run. Hard refresh the app after it succeeds.
8. Then paste [`supabase/migrations/20260923_studio_friendships.sql`](supabase/migrations/20260923_studio_friendships.sql) and run it. This adds same-studio friend linking on the studio chat page. Safe to re-run. Hard refresh the app after it succeeds.
9. Then paste [`supabase/migrations/20260924_sibling_friendships.sql`](supabase/migrations/20260924_sibling_friendships.sql) and run it. This lets two dancer logins in the same family add each other and use friend chat, even when they are not at the same studio. Parents and dancers still cannot be friends. Safe to re-run. Hard refresh the app after it succeeds.
10. Then paste [`supabase/migrations/20260923_chat_sender_labels.sql`](supabase/migrations/20260923_chat_sender_labels.sql) and run it. This corrects studio chat names and the studio friend list. A dancer shows as their first name and surname initial (`Mitch Test` → `Mitch T`; a single name stays as that first name). A parent shows as their first name plus the dancers’ first names at that studio (`Sarah, parent of Evie and Harriet`). New parent sign-ups must enter **Your name (shown in chat)**; it is stored in the existing `profiles.display_name` column — there is no new column to add. Parents who already have an account can add or change it on **Account**. Until a name is saved, chat uses `Parent` (for example `Parent, parent of Evie and Harriet`). The file is safe to re-run. It also repairs a dancer login whose profile role was left as parent, and refreshes labels already saved on studio messages.
11. Then paste [`supabase/migrations/20260925_coparent_family.sql`](supabase/migrations/20260925_coparent_family.sql) and run it **last**. This lets a second parent join the same family. Dancers still use the existing family code. Co-parents use a separate co-parent code or email invite, sign up or log in as a **parent**, and accept. Both parents then see the same dancers, enrolments and results. Studio chat still shows `Sarah, parent of Evie` from **Your name**. The file is safe to re-run. Confirm email stays **OFF**. If you re-run studio chat, studio friendships, sibling friendships, or chat sender labels after this file, run this file again.
12. Family accounts create `profiles`, `children`, `results`, `enrolled_comps`, `enrolled_by_child`, and `enrolled_child_sets` with row-level security. An older `favourites` table may still exist; the app no longer reads or writes it.
13. Dancer friends create `child_friend_settings` and `child_friendships`. Enrolled comps shared with an accepted dancer friend are still child name + comp ids — not a parent email, and not date of birth. New friends are added from the studio chat, not by email.
14. Community chat creates `community_messages` with row-level security so only the two accounts on an **accepted** friendship can read or write that thread. A thread id can be a child friendship or a studio friendship. It also adds the table to `supabase_realtime` so new messages can appear without a full reload. Friend chats are not a public room. Studio friend threads use the same names as studio chat. A child-friend thread does not store a sender label.
15. Dancer accounts add `profiles.role` (`parent` or `dancer`), `profiles.family_id`, `profiles.linked_child_id`, `children.linked_user_id`, a `families` invite code, and email invites. Existing accounts stay parents. Child rows stay owned by the parent until a dancer login is linked. The file is safe to re-run.
16. Studio accounts widen `profiles.role` to include `studio`, add `profiles.is_admin`, a `studios` table, `children.studio_id`, and a public `studio-logos` storage bucket. Pending studios are not public and cannot be linked. The file seeds `admin_allowlist` with `mitch@greenefficientliving.com.au` and marks that existing user `is_admin` when the account already exists. It is safe to re-run.
17. Studio chat creates `studio_community_messages` for an approved studio’s open room. A parent can post when any of their dancers has that `studio_id`, a dancer can post when their linked profile has that `studio_id`, and the studio owner can post once the studio is approved. Pending and rejected studios have no chat. Sender labels are a dancer’s first name and surname initial, a parent’s “{First name}, parent of {first names}”, or the studio name — never an email. The file adds the table to `supabase_realtime`. Run `20260923_chat_sender_labels.sql` after it so names already stored on messages are refreshed.
18. Studio friends create `studio_friendships`. A parent login can request other parents linked to that approved studio. A dancer login can request other dancers linked to that studio. Parents and dancers cannot friend each other. Studio owner logins are not on the list. The directory uses the same names as studio chat (`Mitch T`, or `Sarah, parent of Evie and Harriet`) — never an email. Accepted studio friends can open a friend DM. The file is safe to re-run.
19. Sibling friends let two **dancer** logins that share a `family_id` request each other from **Add sibling** on My Info, Account, or the dancer’s Friends section. They do not have to be at the same studio. The row is a `child_friendships` pair between their linked child profiles, so Community can open the DM. A parent account cannot join that chat. If both siblings are also linked to the same approved studio, the studio chat list marks them **Sibling** and **Add sibling** there is still a same-studio friend. The file is safe to re-run.

If you previously ran an older family-accounts, friends, community, or dancer file, run those files again, then `20260922_studio_accounts.sql`, then `20260922_studio_community_chat.sql`, then `20260923_studio_friendships.sql`, then `20260924_sibling_friendships.sql`, then `20260923_chat_sender_labels.sql`, then `20260925_coparent_family.sql`. They are written to be safe to re-run. Run the co-parent file last.

### Supabase Auth settings

1. **Authentication → Providers → Email** — enable Email.
2. **Authentication → URL Configuration**
   - Site URL: production origin, e.g. `https://my-dance-comps.vercel.app`
   - Redirect URLs (add each):
     - `http://localhost:3000/reset-password`
     - `http://localhost:3000/account`
     - `http://localhost:3000/friends/join`
     - `http://localhost:3000/family/join`
     - `https://my-dance-comps.vercel.app/reset-password`
     - `https://my-dance-comps.vercel.app/account`
     - `https://my-dance-comps.vercel.app/friends/join`
     - `https://my-dance-comps.vercel.app/family/join`
     - `https://*-my-dance-comps.vercel.app/reset-password`
     - `https://*-my-dance-comps.vercel.app/account`
     - `https://*-my-dance-comps.vercel.app/friends/join`
     - `https://*-my-dance-comps.vercel.app/family/join`
3. **Authentication → Providers → Email → Confirm email: OFF.** Leave it off. Parent, dancer and studio sign-up must return a session straight away. The app does not turn confirmation back on.

### Studio approval (Mitch)

1. Run [`supabase/migrations/20260922_studio_accounts.sql`](supabase/migrations/20260922_studio_accounts.sql) in the SQL editor (after the dancer accounts file). Confirm email stays **OFF**.
2. Sign in as `mitch@greenefficientliving.com.au` (the address seeded in `admin_allowlist`). Open **Account → Approve studios**, or go to `/admin`.
3. Pending studios are listed. **Approve** makes the public page live and lets dancers link it. **Reject** keeps it private. A rejected studio can be approved later from the same page.
4. The studio edits its own logo, styles, address and details at `/studio`, including while it is awaiting approval.
5. Another admin: in the SQL editor run `insert into public.admin_allowlist (email) values ('their@email.com') on conflict do nothing;` and set Vercel `NEXT_PUBLIC_ADMIN_EMAILS` to that address (comma-separated if there are several). They then open `/admin` while signed in. Approval is enforced in the database, not only in the page.

### How accounts and friends work

1. Open the app (home loads with no login wall). Add a dancer, tap **Enrolled**, log a result.
2. Header → **Log in** → **Sign up**. Choose **Parent** (your name, email and password — the name is required and is shown in studio chat), **Dancer** (email and password, or a username and PIN of at least 6 characters), or **Studio** (studio name, email and password). Guest family data on that device is merged into a parent or dancer account. With Confirm email off, sign-up logs you in immediately. A new studio lands on **Your studio** with **Awaiting approval**.
3. Account shows the role, counts for dancers / enrolled / results, and **Family** (parents and dancers). Studio accounts skip Family and open the studio editor instead.
4. **Parent:** create a family code (or invite a dancer by the email they will sign up with). **Dancer:** enter that code, pick “I’m this dancer” or “add me”, and the parent’s My Dancers list shows **own login**. One dancer belongs to one family. **Co-parent:** from Account or My Dancers, use **Invite co-parent** (email and/or the co-parent link). The other adult signs up or logs in as a parent, accepts, and shares that family’s dancers, enrolments, My Comps and results. A co-parent can leave while another parent remains. The last parent cannot leave while a dancer still has their own login. If no dancer login remains, leaving stops the family code and keeps the dancer profiles on that parent’s account.
5. A signed-in dancer sees comps, My Comps, friends and Community for themselves. They do not get the household “add another dancer” controls. The parent can still mark **Enrolled** for them. On the dancer profile, search for an approved studio to link it, or type a studio name if it is not listed. Parents use the same control on each dancer.
6. Sign out: the same data stays on the device (guest mode).
7. **Forgot password** works for a real email. Username logins have no mailbox, so use email for a dancer who may need a reset. While they are signed in, Account → **Change password or PIN** updates it without an email.
8. On another browser (or after clearing site data), log in: dancers, enrolled comps (family-wide and per-child) and results come back from Supabase. A linked dancer gets their own profile, not the rest of the household.
9. **Add a friend by email:** My Comps → **Friends’ comps** → parent email (or the dancer’s own email) + their dancer’s name, and which dancer the friendship is for. Or open the dancer on **My Dancers** and share an invite link/code. The other family accepts. A dancer who is logged in can accept requests for themselves.
10. When you tap **Enrolled** for a dancer, that enrolment is shared with that dancer’s friends automatically. Un-enrol removes it from their My Comps friends list. Friends only see the dancer’s name, not the parent account.
11. **Community** (bottom nav) lists accepted-friend conversations by the friend’s dancer name. Open a thread to send and receive messages. Guests see an unlock prompt to log in / add friends. Messaging is signed-in only. A linked dancer sees the threads for their own friendships.
12. **Siblings:** two dancer logins in one family can add each other from My Info or Friends (**Add sibling**). They can message in Community even if they dance at different studios. A parent cannot be friends with a dancer, and a parent does not see that sibling chat.

Logged-in writes debounce (~600ms) up to Supabase. Logged-out / guest writes stay local only. Friends and Community chat are account-only — guests see unlock copy instead.

## Deploy on Vercel

Import this GitHub repo (`main`). Guest mode needs **no** environment variables. Accounts need:

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel ↔ Supabase integration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel ↔ Supabase integration |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Optional. Comma-separated extra admin emails. `mitch@greenefficientliving.com.au` is always included. Add the same address to `admin_allowlist` in Supabase or approval will be refused. |
| `RESEND_API_KEY` | Optional. Together with `REMINDER_EMAIL_FROM`, lets due reminders be emailed to the signed-in account. If either is missing, the app does not send email. |
| `REMINDER_EMAIL_FROM` | Optional. From address on a domain verified with Resend, for example `My Dance Comps <reminders@example.com>`. |

Listings refresh themselves every day:

1. **GitHub Action** (`.github/workflows/daily-scrape.yml`) runs about 6am Adelaide time, rechecks the organiser websites, and commits any changes to `src/data/comps.json`. Vercel then redeploys `main`.
2. **Vercel Cron** (`/api/cron/refresh` at 20:30 UTC) scrapes the same sources into the app cache so the live API can pick up updates even between deploys.

You can also run **Actions → Daily competition scrape → Run workflow** to refresh immediately. GitHub Actions must be enabled on the repo (the default).

## API

- `GET /api/comps` — full competition list (optional filters below)
- `GET /api/comps/:id` — one competition
- `GET /api/sources` — scrape sources
- `GET /api/ics?compId=<id>` — calendar file for one comp
- `GET /api/ics` — empty calendar. Reminder `.ics` files are downloaded from the Reminders page so they follow dancer styles.
- `GET /api/reminders/email` — `{ configured: true }` only when `RESEND_API_KEY` and `REMINDER_EMAIL_FROM` are both set. Otherwise email is not sent.

Query params for `/api/comps`:

| Param | Example | Meaning |
| --- | --- | --- |
| `q` | `jazz` | Search name, suburb, style, organiser |
| `dob` | `2018-06-15` | Child date of birth (age as at 1 January of the comp year) |
| `state` | `SA` | Home state. Filters to that state + nationals (even without `dob`). |
| `styles` | `Jazz,Tap` | Preferred styles (overlap) |
| `interstate` | `1` | Include other states when a home `state` (or child `dob`+`state`) is applied |
| `sort` | `desc` | Date order relative to today in Australia/Adelaide (`asc` default = soonest first; `desc` = latest first). Upcoming (start today or later) first, then past by most recent start. Undated last. |
| `status` | `open,closing-soon` | Registration status filter (`open`, `closing-soon`, `closed`, `opens-soon`, `unknown`). Omit for all. |

## What the app does

- **Comps** — dates, venue (name, suburb, state), registration open/close, styles, organiser, registration links. The main list defaults to the selected child’s **home state plus National finals**. Interstate events stay hidden until you turn on **Include interstate comps**. If no dancer is selected, the list uses the last-used / first child’s home state, or asks you to pick a state chip. Age (as at 1 January) and overlapping styles still apply for the selected child. Filter by entry status (open / closing soon / closed / opening / dates TBC). Sort by event date relative to **today in Australia/Adelaide** (soonest first by default: nearest upcoming start, then past by most recent; or latest first: farthest upcoming start, then past by most recent). Past comps stay in the list after upcoming ones — they are not treated as “soonest”. Finished events (end date, or start if no end, before Adelaide today) are shown with a muted mint-grey card so they read as “already been” without changing entry-status colours. Sort and status choices are stored in `localStorage`. Each card has an **Enrolled** toggle beside **Register**. When it is on, the button is pastel yellow (`#F5E6A8`). It stores a confirmed entry in the same `localStorage` family blob. If a dancer is selected, enrolment is stored for that child (`enrolledByChild`); if Everyone is selected, it uses the family-wide `enrolled` list. Tap again to un-enrol. Existing family-wide ids still show for each child until that child gets their own set. **Reviews:** finished comps (end date before today in Australia/Adelaide) show an average star rating and review count, plus a 1–5 star control and optional comment on the detail page. Guests store one review per competition in `localStorage`. Aggregates on this device only — they do not pretend other families have reviewed. A public reviews list stays stubbed until `NEXT_PUBLIC_REVIEWS_PUBLIC=1`. The `reviews` table SQL lives in [`supabase/migrations/20260921_reviews.sql`](supabase/migrations/20260921_reviews.sql).
- **My Comps** — enrolled competitions only, with an **All dancers** filter plus a chip per dancer. Cards match the main Comps list (date order, venue/address, status chips, Enrolled tagged so you can un-enrol here too) and sit first under the dancer filter. A **month calendar** below the list (status dots, an enrolled star on the date, muted past dates) plots only those enrolled comps for the active dancer filter. `/calendar` redirects here. Interstate enrolled comps stay visible, matching the list — there is no extra home-state hide. Months with no enrolled dates show a friendly empty state. Signed-in families also get **Friends’ comps**: read-only cards for comps a friend’s dancer has marked Enrolled, labelled with that dancer’s name only. Add a friend by parent email on the same page. Guest data stays in `localStorage`; signed-in enrolments sync and are shared with friends automatically.
- **My Dancers** — dancer profiles (no hard cap of two; soft max 20): name, date of birth, preferred styles, dance studio, home state. The tab and page title read **My Dancer** when there is exactly one profile, and **Profile** on a dancer login. Per-dancer results log (manual). Route stays `/kids`. Link an **approved** studio by searching its name, or type a name if the studio is not on My Dance Comps yet. Parents set this on a dancer profile. A dancer login sets it on their own profile. Both paths stay. When signed in: **Friends** (share invite, add by parent email, accept/decline, remove). Friendship is between dancers; parents stay in control.
- **Studios** — `/studios` lists approved studios. `/studios/[slug]` is the public page (logo, about, styles, address, phone, email, website). Pending and rejected studios are not listed and are not linkable. The owner can still open their page and see **Awaiting approval**. `/studio` is the owner editor. `/admin` is the approval list (Approve / Reject) for Mitch’s admin email, or any address in `admin_allowlist` / `NEXT_PUBLIC_ADMIN_EMAILS`.
- **Community** — **Studio chats** for families linked to an approved studio (one open room per studio). A dancer shows as their first name and surname initial (`Mitch T`). A parent shows as their first name plus the dancers’ first names (`Sarah, parent of Evie and Harriet`), or `Parent` until they save a name on Account. The studio owner shows as the studio name. Studio friend lists and those friend chats use the same names. Emails are never shown. Guests get a log-in / sign-up unlock. Pending and rejected studios have no chat, and strangers cannot join a studio room. `/saved` redirects home.
- **Account** — email/password. Header **Log in** when signed out, **Account** when signed in. Parent sign-up asks for **Your name (shown in chat)** and will not finish without it. Account keeps the same field so an existing parent can add or change it; if it is still blank, studio chat uses Parent. Guest browsing stays available.
- **Reminders** — two toggles: **newly announced competitions** (primary) and **when entries open**. Both apply only to comps that match at least one dancer’s styles, using the same home-state and interstate rules as the Comps list. A dancer with no styles selected matches every style until styles are set on My Dancers / My Info. The first visit records the current listings (device `localStorage` watermark) so existing comps are not all announced; later listings can. In-app list is the main delivery. Optional browser notifications while the site is open. **Also email me** stores the preference and, when you are signed in, addresses a mail draft to the account email. Server email is sent only when Resend is configured; until then the page says so and does not pretend mail went out. `.ics` download remains.

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

Guests: dancers, confirmed entries (`enrolled` / `enrolledByChild`), results, and reviews stay on the device in `localStorage`. They never leave the browser unless you export a calendar, email a reminder list, or **choose** to create an account. Confirmed entries live in `mydancecomps.family.v1`. Reviews use `mydancecomps.reviews.v1`.

Signed-in families: dancers, enrolled comps (family-wide and per-child) and results sync to your Supabase project under row-level security. Approved studio profiles (name, logo, styles, address and contact details) are public. Pending studio sign-ups are visible to the studio and to an admin only. A dancer’s link stores the approved studio id on that dancer profile. A dancer login reads and updates only their linked profile, enrolments and results. Friends only see a dancer’s **name** and the comps that dancer is enrolled in — not the parent email, not date of birth. Community messages are stored in Supabase and are readable only by the accounts on that accepted friendship (the parent who owns the profile, and the dancer when their login is linked). Either side can remove the friend, or turn off sharing enrolled comps, at any time. Passwords and PINs are handled by Supabase Auth, not stored in this app. Username logins use an internal address at `dancers.mydancecomps.app` so they can sign in without a mailbox while Confirm email is off.
