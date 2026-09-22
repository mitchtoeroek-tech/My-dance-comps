-- Reminder preferences: newly announced comps, entries opening, and an email opt-in.
-- Week-before / day-before close are no longer read by the app.
-- Existing rows keep their JSON; the app fills missing fields when it loads a profile.

alter table public.profiles
  alter column reminder_prefs set default
  '{"newlyAnnounced":true,"onOpen":true,"emailEnabled":false}'::jsonb;
