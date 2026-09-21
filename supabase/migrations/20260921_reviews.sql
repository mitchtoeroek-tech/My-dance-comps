-- My Dance Comps — public competition reviews
-- Scaffolding only. Public reviews stay off until NEXT_PUBLIC_REVIEWS_PUBLIC=1.
-- Guest MVP on main stores reviews in localStorage
-- (`mydancecomps.reviews.v1`, keyed by competition id).
--
-- Shape matches `CompReview` in src/lib/types.ts:
--   competitionId, userId, displayName, stars 1–5, optional comment,
--   createdAt, updatedAt.
-- One review per user per competition (upsert on competition_id + user_id).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, user_id)
);

create index if not exists reviews_competition_id_idx
  on public.reviews (competition_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute procedure public.set_updated_at();

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_public" on public.reviews;
drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_update_own" on public.reviews;
drop policy if exists "reviews_delete_own" on public.reviews;

-- Visible to everyone once this table is live.
create policy "reviews_select_public" on public.reviews
  for select to anon, authenticated using (true);

create policy "reviews_insert_own" on public.reviews
  for insert to authenticated with check (auth.uid() = user_id);

create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews_delete_own" on public.reviews
  for delete to authenticated using (auth.uid() = user_id);

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
