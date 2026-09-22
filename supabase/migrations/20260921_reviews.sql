-- My Dance Comps — public competition reviews.
-- Anyone can read them. A signed-in account can publish one review per competition.
-- Guests are not written here; they sign in to share a rating.
--
-- Shape matches `CompReview` in src/lib/types.ts.
-- One review per user per competition (upsert on competition_id + user_id).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  competition_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
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

create or replace function public.sanitize_review_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.comment := left(btrim(coalesce(new.comment, '')), 500);
  if new.display_name is null
     or btrim(new.display_name) = ''
     or position('@' in new.display_name) > 0 then
    new.display_name := 'Member';
  else
    new.display_name := left(regexp_replace(btrim(new.display_name), '\s+', ' ', 'g'), 80);
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_sanitize_row on public.reviews;
create trigger reviews_sanitize_row
  before insert or update on public.reviews
  for each row execute procedure public.sanitize_review_row();

revoke all on function public.sanitize_review_row() from public, anon, authenticated;

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
