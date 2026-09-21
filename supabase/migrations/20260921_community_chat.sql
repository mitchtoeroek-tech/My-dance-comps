-- My Dance Comps — friends-only Community chat
-- Run AFTER 20260921_kids_friends.sql in the Supabase SQL editor.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- Direct messages live on an accepted child_friendships row. Only the two
-- parent accounts on that friendship can read or write the thread. There is
-- no public room. Removing or declining the friend stops access (and pending
-- / declined threads drop their messages).

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.child_friendships (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_messages_body_len check (
    char_length(btrim(body)) > 0 and char_length(body) <= 2000
  )
);

create index if not exists community_messages_thread_idx
  on public.community_messages (friendship_id, created_at);

alter table public.community_messages replica identity full;

alter table public.community_messages enable row level security;

create or replace function public.is_community_thread_member(p_friendship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.child_friendships f
    where f.id = p_friendship_id
      and f.status = 'accepted'
      and (
        f.requester_user_id = auth.uid()
        or f.addressee_user_id = auth.uid()
      )
  );
$$;

create or replace function public.purge_community_messages_if_unfriended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from 'accepted' then
    delete from public.community_messages where friendship_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists child_friendships_purge_community
  on public.child_friendships;
create trigger child_friendships_purge_community
  after update of status on public.child_friendships
  for each row execute procedure public.purge_community_messages_if_unfriended();

drop policy if exists "community_messages_select_friends" on public.community_messages;
drop policy if exists "community_messages_insert_own" on public.community_messages;
drop policy if exists "community_messages_update_none" on public.community_messages;
drop policy if exists "community_messages_delete_none" on public.community_messages;

create policy "community_messages_select_friends" on public.community_messages
  for select to authenticated
  using (public.is_community_thread_member(friendship_id));

create policy "community_messages_insert_own" on public.community_messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.is_community_thread_member(friendship_id)
  );

grant select, insert on public.community_messages to authenticated;

revoke all on function public.is_community_thread_member(uuid) from public, anon;
grant execute on function public.is_community_thread_member(uuid) to authenticated;

revoke all on function public.purge_community_messages_if_unfriended() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.community_messages';
  end if;
exception
  when undefined_object then
    raise notice 'supabase_realtime publication is not on this database; skip realtime add';
end;
$$;
