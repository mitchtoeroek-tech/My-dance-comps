-- My Dance Comps — open studio chat
-- Run AFTER 20260922_studio_accounts.sql in the Supabase SQL editor.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- This file does not change community_messages, child_friendships, or
-- email confirmation. Friends-only direct messages stay as they are.
--
-- One open room per approved studio. A signed-in user can read and write
-- when they own that studio, when a dancer they own (children.user_id)
-- is linked to it, or when their dancer login is linked to a child on it
-- (children.linked_user_id or profiles.linked_child_id). Pending and
-- rejected studios have no chat. Sender labels are set in the database
-- (dancer name, "Parent of …", or studio name) so emails are never shown.

create table if not exists public.studio_community_messages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  sender_label text not null default 'Member',
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.studio_community_messages
  add column if not exists sender_label text;

update public.studio_community_messages
set sender_label = 'Member'
where sender_label is null or btrim(sender_label) = '';

alter table public.studio_community_messages
  alter column sender_label set default 'Member';

alter table public.studio_community_messages
  alter column sender_label set not null;

alter table public.studio_community_messages
  drop constraint if exists studio_community_messages_body_len;
alter table public.studio_community_messages
  add constraint studio_community_messages_body_len check (
    char_length(btrim(body)) > 0 and char_length(body) <= 2000
  );

alter table public.studio_community_messages
  drop constraint if exists studio_community_messages_label_len;
alter table public.studio_community_messages
  add constraint studio_community_messages_label_len check (
    char_length(btrim(sender_label)) > 0 and char_length(sender_label) <= 160
  );

create index if not exists studio_community_messages_thread_idx
  on public.studio_community_messages (studio_id, created_at);

alter table public.studio_community_messages replica identity full;

alter table public.studio_community_messages enable row level security;

create or replace function public.is_studio_chat_member(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.studios s
      where s.id = p_studio_id
        and s.status = 'approved'
        and (
          s.owner_id = auth.uid()
          or exists (
            select 1
            from public.children c
            where c.studio_id = s.id
              and (
                c.user_id = auth.uid()
                or c.linked_user_id = auth.uid()
              )
          )
          or exists (
            select 1
            from public.profiles p
            join public.children c on c.id = p.linked_child_id
            where p.id = auth.uid()
              and p.role = 'dancer'
              and c.studio_id = s.id
          )
        )
    );
$$;

create or replace function public.studio_chat_sender_label(
  p_studio_id uuid,
  p_user uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_display text;
  v_studio_name text;
  v_dancer_name text;
  v_names text[];
  v_count int;
  v_label text;
begin
  if p_user is null then
    return 'Member';
  end if;

  select nullif(btrim(s.name), '')
  into v_studio_name
  from public.studios s
  where s.id = p_studio_id
    and s.owner_id = p_user;

  if v_studio_name is not null then
    if position('@' in v_studio_name) = 0 then
      return left(v_studio_name, 80);
    end if;
    return 'Studio';
  end if;

  select p.role, nullif(btrim(p.display_name), '')
  into v_role, v_display
  from public.profiles p
  where p.id = p_user;

  if v_display is not null and position('@' in v_display) > 0 then
    v_display := null;
  end if;

  if v_role = 'dancer' then
    select nullif(btrim(c.name), '')
    into v_dancer_name
    from public.children c
    where c.studio_id = p_studio_id
      and (
        c.linked_user_id = p_user
        or c.id = (
          select pr.linked_child_id
          from public.profiles pr
          where pr.id = p_user
        )
      )
      and position('@' in c.name) = 0
    order by c.created_at
    limit 1;

    if v_dancer_name is null then
      select nullif(btrim(c.name), '')
      into v_dancer_name
      from public.children c
      where c.studio_id = p_studio_id
        and c.user_id = p_user
        and position('@' in c.name) = 0
      order by c.created_at
      limit 1;
    end if;

    if v_dancer_name is not null then
      return left(v_dancer_name, 80);
    end if;
    if v_display is not null then
      return left(v_display, 80);
    end if;
    return 'Dancer';
  end if;

  select coalesce(array_agg(n order by n), '{}'::text[])
  into v_names
  from (
    select distinct left(btrim(c.name), 80) as n
    from public.children c
    where c.studio_id = p_studio_id
      and c.user_id = p_user
      and nullif(btrim(c.name), '') is not null
      and position('@' in c.name) = 0
  ) names;

  v_count := coalesce(cardinality(v_names), 0);
  if v_count = 1 then
    v_label := 'Parent of ' || v_names[1];
  elsif v_count = 2 then
    v_label := 'Parent of ' || v_names[1] || ' and ' || v_names[2];
  elsif v_count > 2 then
    v_label := 'Parent of '
      || array_to_string(v_names[1:v_count - 1], ', ')
      || ' and '
      || v_names[v_count];
  else
    v_label := null;
  end if;

  if v_label is not null then
    return left(v_label, 160);
  end if;
  if v_display is not null then
    return left(v_display, 80);
  end if;
  return 'Member';
end;
$$;

create or replace function public.set_studio_community_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if tg_op is distinct from 'INSERT' then
    raise exception 'Not available';
  end if;
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  new.sender_user_id := auth.uid();
  v_label := public.studio_chat_sender_label(new.studio_id, auth.uid());
  if v_label is null or btrim(v_label) = '' or position('@' in v_label) > 0 then
    v_label := 'Member';
  end if;
  new.sender_label := left(btrim(v_label), 160);
  return new;
end;
$$;

drop trigger if exists studio_community_messages_set_sender
  on public.studio_community_messages;
create trigger studio_community_messages_set_sender
  before insert on public.studio_community_messages
  for each row execute procedure public.set_studio_community_sender();

create or replace function public.list_my_studio_chats()
returns table (
  studio_id uuid,
  name text,
  slug text,
  logo_path text,
  updated_at timestamptz,
  last_body text,
  last_sender_label text,
  last_created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select s.id, s.name, s.slug, s.logo_path, s.updated_at
    from public.studios s
    where s.status = 'approved'
      and public.is_studio_chat_member(s.id)
  )
  select
    mine.id,
    mine.name,
    mine.slug,
    mine.logo_path,
    mine.updated_at,
    last_msg.body,
    last_msg.sender_label,
    last_msg.created_at
  from mine
  left join lateral (
    select m.body, m.sender_label, m.created_at
    from public.studio_community_messages m
    where m.studio_id = mine.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  order by last_msg.created_at desc nulls last, mine.name;
$$;

drop policy if exists "studio_community_messages_select_members"
  on public.studio_community_messages;
drop policy if exists "studio_community_messages_insert_own"
  on public.studio_community_messages;

create policy "studio_community_messages_select_members"
  on public.studio_community_messages
  for select to authenticated
  using (public.is_studio_chat_member(studio_id));

create policy "studio_community_messages_insert_own"
  on public.studio_community_messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and public.is_studio_chat_member(studio_id)
  );

revoke all on public.studio_community_messages from public, anon, authenticated;
grant select, insert on public.studio_community_messages to authenticated;

revoke all on function public.is_studio_chat_member(uuid) from public, anon;
grant execute on function public.is_studio_chat_member(uuid) to authenticated;

revoke all on function public.list_my_studio_chats() from public, anon;
grant execute on function public.list_my_studio_chats() to authenticated;

revoke all on function public.studio_chat_sender_label(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_studio_community_sender() from public, anon;
grant execute on function public.set_studio_community_sender() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_community_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.studio_community_messages';
  end if;
exception
  when undefined_object then
    raise notice 'supabase_realtime publication is not on this database; skip realtime add';
end;
$$;
