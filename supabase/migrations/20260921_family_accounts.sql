-- My Dance Comps — family accounts
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: objects are created or replaced idempotently.
--
-- After running:
-- 1. Authentication → Providers → Email: enable Email.
-- 2. Authentication → URL Configuration:
--    Site URL = your production origin (e.g. https://my-dance-comps.vercel.app)
--    Redirect URLs include:
--      http://localhost:3000/reset-password
--      http://localhost:3000/account
--      https://<your-domain>/reset-password
--      https://<your-domain>/account
--      https://*-my-dance-comps.vercel.app/reset-password
--      https://*-my-dance-comps.vercel.app/account
-- 3. Confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
--    are set in Vercel (Vercel ↔ Supabase integration usually injects these).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  selected_child_id text,
  include_interstate boolean not null default false,
  preferred_state text,
  reminder_prefs jsonb not null default '{"onOpen":true,"weekBeforeClose":true,"dayBeforeClose":true}'::jsonb,
  notified_reminder_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.children (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dob text not null default '',
  styles text[] not null default '{}'::text[],
  studio text not null default '',
  home_state text not null default 'SA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists children_user_id_idx on public.children (user_id);

create table if not exists public.favourites (
  user_id uuid not null references auth.users (id) on delete cascade,
  comp_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, comp_id)
);

create table if not exists public.results (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  child_id text not null,
  comp_id text,
  comp_name text not null default 'Competition',
  date text not null default '',
  section text not null default '',
  -- Quoted: PLACING is a PostgreSQL reserved word (OVERLAY ... PLACING ...).
  "placing" text not null default '',
  score text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists results_user_id_idx on public.results (user_id);

-- Family-wide confirmed entries, same shape as favourites in localStorage.
create table if not exists public.enrolled_comps (
  user_id uuid not null references auth.users (id) on delete cascade,
  comp_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, comp_id)
);

-- Per-child confirmed entries. A missing child means they still use the
-- family-wide enrolled_comps list until their first Enrolled toggle.
create table if not exists public.enrolled_by_child (
  user_id uuid not null references auth.users (id) on delete cascade,
  child_id text not null references public.children (id) on delete cascade,
  comp_id text not null,
  created_at timestamptz not null default now(),
  primary key (child_id, comp_id)
);

create index if not exists enrolled_by_child_user_id_idx
  on public.enrolled_by_child (user_id);

-- Which children have their own enrolled set (including empty after un-enrol).
create table if not exists public.enrolled_child_sets (
  child_id text primary key references public.children (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade
);

create index if not exists enrolled_child_sets_user_id_idx
  on public.enrolled_child_sets (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at
  before update on public.children
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.favourites enable row level security;
alter table public.results enable row level security;
alter table public.enrolled_comps enable row level security;
alter table public.enrolled_by_child enable row level security;
alter table public.enrolled_child_sets enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "children_select_own" on public.children;
drop policy if exists "children_insert_own" on public.children;
drop policy if exists "children_update_own" on public.children;
drop policy if exists "children_delete_own" on public.children;
create policy "children_select_own" on public.children
  for select to authenticated using (auth.uid() = user_id);
create policy "children_insert_own" on public.children
  for insert to authenticated with check (auth.uid() = user_id);
create policy "children_update_own" on public.children
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "children_delete_own" on public.children
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "favourites_select_own" on public.favourites;
drop policy if exists "favourites_insert_own" on public.favourites;
drop policy if exists "favourites_delete_own" on public.favourites;
create policy "favourites_select_own" on public.favourites
  for select to authenticated using (auth.uid() = user_id);
create policy "favourites_insert_own" on public.favourites
  for insert to authenticated with check (auth.uid() = user_id);
create policy "favourites_delete_own" on public.favourites
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "results_select_own" on public.results;
drop policy if exists "results_insert_own" on public.results;
drop policy if exists "results_update_own" on public.results;
drop policy if exists "results_delete_own" on public.results;
create policy "results_select_own" on public.results
  for select to authenticated using (auth.uid() = user_id);
create policy "results_insert_own" on public.results
  for insert to authenticated with check (auth.uid() = user_id);
create policy "results_update_own" on public.results
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "results_delete_own" on public.results
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "enrolled_select_own" on public.enrolled_comps;
drop policy if exists "enrolled_insert_own" on public.enrolled_comps;
drop policy if exists "enrolled_delete_own" on public.enrolled_comps;
create policy "enrolled_select_own" on public.enrolled_comps
  for select to authenticated using (auth.uid() = user_id);
create policy "enrolled_insert_own" on public.enrolled_comps
  for insert to authenticated with check (auth.uid() = user_id);
create policy "enrolled_delete_own" on public.enrolled_comps
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "enrolled_by_child_select_own" on public.enrolled_by_child;
drop policy if exists "enrolled_by_child_insert_own" on public.enrolled_by_child;
drop policy if exists "enrolled_by_child_delete_own" on public.enrolled_by_child;
create policy "enrolled_by_child_select_own" on public.enrolled_by_child
  for select to authenticated using (auth.uid() = user_id);
create policy "enrolled_by_child_insert_own" on public.enrolled_by_child
  for insert to authenticated with check (auth.uid() = user_id);
create policy "enrolled_by_child_delete_own" on public.enrolled_by_child
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "enrolled_child_sets_select_own" on public.enrolled_child_sets;
drop policy if exists "enrolled_child_sets_insert_own" on public.enrolled_child_sets;
drop policy if exists "enrolled_child_sets_delete_own" on public.enrolled_child_sets;
create policy "enrolled_child_sets_select_own" on public.enrolled_child_sets
  for select to authenticated using (auth.uid() = user_id);
create policy "enrolled_child_sets_insert_own" on public.enrolled_child_sets
  for insert to authenticated with check (auth.uid() = user_id);
create policy "enrolled_child_sets_delete_own" on public.enrolled_child_sets
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, insert, delete on public.favourites to authenticated;
grant select, insert, update, delete on public.results to authenticated;
grant select, insert, delete on public.enrolled_comps to authenticated;
grant select, insert, delete on public.enrolled_by_child to authenticated;
grant select, insert, delete on public.enrolled_child_sets to authenticated;
