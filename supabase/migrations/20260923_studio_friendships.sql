-- My Dance Comps — same-studio, role-locked friends
-- Run AFTER 20260922_studio_community_chat.sql in the Supabase SQL editor.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- Friend linking on a studio chat is account-to-account:
--   * a parent login can add other parents linked to that approved studio
--   * a dancer login can add other dancers linked to that approved studio
--   * parents and dancers cannot be friends with each other
--   * a studio owner is not in this graph unless they also have a parent account
--
-- Rows live in studio_friendships (studio_id + role). Child friendships stay
-- for existing dancer enrolled-comp sharing. New parent adds do not create
-- child friendships. Accepted studio friends can use the existing friend DM
-- thread (community_messages.friendship_id). Labels never include emails.

create table if not exists public.studio_friendships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  friend_role text not null,
  user_low_id uuid not null references auth.users (id) on delete cascade,
  user_high_id uuid not null references auth.users (id) on delete cascade,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  addressee_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_friendships_ordered check (user_low_id < user_high_id),
  constraint studio_friendships_distinct check (user_low_id <> user_high_id),
  constraint studio_friendships_pair unique (studio_id, user_low_id, user_high_id)
);

alter table public.studio_friendships drop constraint if exists studio_friendships_role_check;
alter table public.studio_friendships
  add constraint studio_friendships_role_check
  check (friend_role in ('parent', 'dancer'));

alter table public.studio_friendships drop constraint if exists studio_friendships_status_check;
alter table public.studio_friendships
  add constraint studio_friendships_status_check
  check (status in ('pending', 'accepted', 'declined'));

create index if not exists studio_friendships_studio_status_idx
  on public.studio_friendships (studio_id, status);
create index if not exists studio_friendships_requester_idx
  on public.studio_friendships (requester_user_id);
create index if not exists studio_friendships_addressee_idx
  on public.studio_friendships (addressee_user_id);

drop trigger if exists studio_friendships_set_updated_at
  on public.studio_friendships;
create trigger studio_friendships_set_updated_at
  before update on public.studio_friendships
  for each row execute procedure public.set_updated_at();

alter table public.studio_friendships enable row level security;

drop policy if exists "studio_friendships_select_participant"
  on public.studio_friendships;
create policy "studio_friendships_select_participant"
  on public.studio_friendships
  for select to authenticated
  using (
    auth.uid() = requester_user_id
    or auth.uid() = addressee_user_id
  );

revoke all on public.studio_friendships from public, anon, authenticated;
grant select on public.studio_friendships to authenticated;

-- Friend DMs may point at a child friendship or a studio friendship.
-- Membership is checked in is_community_thread_member. Delete/unfriend
-- still removes the thread.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'community_messages'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%child_friendships%'
  loop
    execute format(
      'alter table public.community_messages drop constraint %I',
      r.conname
    );
  end loop;
end;
$$;

create or replace function public.user_on_studio_role(
  p_user uuid,
  p_studio_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and p_studio_id is not null
    and p_role in ('parent', 'dancer')
    and exists (
      select 1
      from public.studios s
      where s.id = p_studio_id
        and s.status = 'approved'
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = p_user
        and p.role = p_role
    )
    and (
      (
        p_role = 'parent'
        and exists (
          select 1
          from public.children c
          where c.user_id = p_user
            and c.studio_id = p_studio_id
        )
      )
      or (
        p_role = 'dancer'
        and exists (
          select 1
          from public.children c
          where c.studio_id = p_studio_id
            and (
              c.linked_user_id = p_user
              or c.user_id = p_user
              or c.id = (
                select pr.linked_child_id
                from public.profiles pr
                where pr.id = p_user
              )
            )
        )
      )
    );
$$;

create or replace function public.accounts_are_parent_and_child(
  p_a uuid,
  p_b uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_a is not null
    and p_b is not null
    and p_a <> p_b
    and exists (
      select 1
      from public.children c
      left join public.profiles pa on pa.id = p_a
      left join public.profiles pb on pb.id = p_b
      where
        (
          c.user_id = p_a
          and (
            c.linked_user_id = p_b
            or c.id = pb.linked_child_id
          )
        )
        or (
          c.user_id = p_b
          and (
            c.linked_user_id = p_a
            or c.id = pa.linked_child_id
          )
        )
    );
$$;

-- Same wording as studio chat: Mitch T, or Sarah, parent of Evie and Harriet.
-- studio_chat_sender_label is replaced by 20260923_chat_sender_labels.sql.
-- Run that file after this one so an older chat function is not reused.
create or replace function public.studio_friend_public_label(
  p_studio_id uuid,
  p_user uuid,
  p_role text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  v_label := nullif(btrim(public.studio_chat_sender_label(p_studio_id, p_user)), '');
  if v_label is null or position('@' in v_label) > 0 then
    if p_role = 'dancer' then
      return 'Dancer';
    end if;
    return 'Parent';
  end if;
  return left(v_label, 160);
end;
$$;

create or replace function public.list_studio_friends(p_studio_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_studio_name text;
  v_can boolean := false;
  v_suggest jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
  v_friends jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_studio_chat_member(p_studio_id) then
    raise exception 'This studio chat is not open to you';
  end if;

  select nullif(btrim(s.name), '')
  into v_studio_name
  from public.studios s
  where s.id = p_studio_id
    and s.status = 'approved';

  if v_studio_name is null or position('@' in v_studio_name) > 0 then
    v_studio_name := 'Studio';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_user;

  if v_role is distinct from 'parent' and v_role is distinct from 'dancer' then
    v_role := case when v_role = 'studio' then 'studio' else 'none' end;
  end if;

  v_can := public.user_on_studio_role(v_user, p_studio_id, v_role);

  if not v_can then
    return jsonb_build_object(
      'studio_name', left(v_studio_name, 120),
      'viewer_role', v_role,
      'can_add', false,
      'suggest', '[]'::jsonb,
      'incoming', '[]'::jsonb,
      'outgoing', '[]'::jsonb,
      'friends', '[]'::jsonb
    );
  end if;

  with people as (
    select
      p.id as user_id,
      public.studio_friend_public_label(p_studio_id, p.id, v_role) as label
    from public.profiles p
    where p.role = v_role
      and p.id <> v_user
      and public.user_on_studio_role(p.id, p_studio_id, v_role)
      and not public.accounts_are_parent_and_child(v_user, p.id)
  ),
  links as (
    select
      people.user_id,
      people.label,
      f.id as friendship_id,
      f.status,
      f.requester_user_id,
      f.addressee_user_id
    from people
    left join public.studio_friendships f
      on f.studio_id = p_studio_id
     and f.friend_role = v_role
     and f.user_low_id = least(v_user, people.user_id)
     and f.user_high_id = greatest(v_user, people.user_id)
  )
  select
    coalesce((
      select jsonb_agg(
        jsonb_build_object('user_id', user_id, 'label', label)
        order by label
      )
      from links
      where friendship_id is null or status = 'declined'
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'label', label,
          'friendship_id', friendship_id
        )
        order by label
      )
      from links
      where status = 'pending'
        and addressee_user_id = v_user
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'label', label,
          'friendship_id', friendship_id
        )
        order by label
      )
      from links
      where status = 'pending'
        and requester_user_id = v_user
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'label', label,
          'friendship_id', friendship_id
        )
        order by label
      )
      from links
      where status = 'accepted'
    ), '[]'::jsonb)
  into v_suggest, v_incoming, v_outgoing, v_friends;

  return jsonb_build_object(
    'studio_name', left(v_studio_name, 120),
    'viewer_role', v_role,
    'can_add', true,
    'suggest', v_suggest,
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'friends', v_friends
  );
end;
$$;

create or replace function public.request_studio_friend(
  p_studio_id uuid,
  p_other_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_other_role text;
  v_low uuid;
  v_high uuid;
  v_existing public.studio_friendships%rowtype;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user then
    raise exception 'That is you';
  end if;

  if not public.is_studio_chat_member(p_studio_id) then
    raise exception 'This studio chat is not open to you';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_user;

  if v_role = 'studio' then
    raise exception 'Studio accounts are not on the friend list';
  end if;

  if v_role is distinct from 'parent' and v_role is distinct from 'dancer' then
    raise exception 'Add friends from a parent or dancer login';
  end if;

  if not public.user_on_studio_role(v_user, p_studio_id, v_role) then
    raise exception 'You can only add people at this studio';
  end if;

  select p.role
  into v_other_role
  from public.profiles p
  where p.id = p_other_user_id;

  if v_other_role is distinct from v_role then
    if v_other_role in ('parent', 'dancer', 'studio') then
      if v_role = 'parent' then
        raise exception 'Parents can only add other parents';
      end if;
      raise exception 'Dancers can only add other dancers';
    end if;
    raise exception 'You can only add people at this studio';
  end if;

  if not public.user_on_studio_role(p_other_user_id, p_studio_id, v_role) then
    raise exception 'You can only add people at this studio';
  end if;

  if public.accounts_are_parent_and_child(v_user, p_other_user_id) then
    raise exception 'Parents and dancers cannot be friends';
  end if;

  v_low := least(v_user, p_other_user_id);
  v_high := greatest(v_user, p_other_user_id);

  select *
  into v_existing
  from public.studio_friendships
  where studio_id = p_studio_id
    and user_low_id = v_low
    and user_high_id = v_high;

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'Already friends at this studio';
    end if;
    if v_existing.status = 'pending' then
      if v_existing.addressee_user_id = v_user then
        raise exception 'They already sent you a request';
      end if;
      raise exception 'That friend request is already waiting';
    end if;

    update public.studio_friendships
    set friend_role = v_role,
        requester_user_id = v_user,
        addressee_user_id = p_other_user_id,
        status = 'pending'
    where id = v_existing.id
    returning id into v_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'pending',
      'friendship_id', v_id
    );
  end if;

  insert into public.studio_friendships (
    studio_id,
    friend_role,
    user_low_id,
    user_high_id,
    requester_user_id,
    addressee_user_id,
    status
  )
  values (
    p_studio_id,
    v_role,
    v_low,
    v_high,
    v_user,
    p_other_user_id,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'pending',
    'friendship_id', v_id
  );
end;
$$;

create or replace function public.respond_studio_friend(
  p_friendship_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.studio_friendships%rowtype;
  v_other uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.studio_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that request';
  end if;

  if v_row.addressee_user_id <> v_user then
    raise exception 'Not your request to answer';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'That request is no longer waiting';
  end if;

  v_other := case
    when v_row.requester_user_id = v_user then v_row.addressee_user_id
    else v_row.requester_user_id
  end;

  if coalesce(p_accept, false) then
    if v_row.friend_role not in ('parent', 'dancer')
       or not public.user_on_studio_role(v_user, v_row.studio_id, v_row.friend_role)
       or not public.user_on_studio_role(v_other, v_row.studio_id, v_row.friend_role)
       or public.accounts_are_parent_and_child(v_user, v_other) then
      raise exception 'You can only add people at this studio';
    end if;
  end if;

  update public.studio_friendships
  set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end
  where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when coalesce(p_accept, false) then 'accepted' else 'declined' end,
    'friendship_id', p_friendship_id
  );
end;
$$;

create or replace function public.remove_studio_friend(p_friendship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.studio_friendships%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.studio_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that friend';
  end if;

  if v_row.requester_user_id <> v_user and v_row.addressee_user_id <> v_user then
    raise exception 'Not your friend to remove';
  end if;

  delete from public.studio_friendships where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'removed',
    'friendship_id', p_friendship_id
  );
end;
$$;

create or replace function public.list_my_studio_friend_threads()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_threads jsonb;
  v_incoming int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int
  into v_incoming
  from public.studio_friendships f
  where f.addressee_user_id = v_user
    and f.status = 'pending';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'studio_id', f.studio_id,
        'studio_name', case
          when s.name is null or position('@' in s.name) > 0 then 'Studio'
          else left(btrim(s.name), 120)
        end,
        'label', public.studio_friend_public_label(
          f.studio_id,
          case
            when f.requester_user_id = v_user then f.addressee_user_id
            else f.requester_user_id
          end,
          f.friend_role
        )
      )
      order by s.name
    ),
    '[]'::jsonb
  )
  into v_threads
  from public.studio_friendships f
  join public.studios s on s.id = f.studio_id
  where f.status = 'accepted'
    and s.status = 'approved'
    and (f.requester_user_id = v_user or f.addressee_user_id = v_user);

  return jsonb_build_object(
    'incoming_count', coalesce(v_incoming, 0),
    'threads', v_threads
  );
end;
$$;

create or replace function public.is_community_thread_member(p_friendship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.child_friendships f
        where f.id = p_friendship_id
          and f.status = 'accepted'
          and (
            f.requester_user_id = auth.uid()
            or f.addressee_user_id = auth.uid()
            or public.actor_can_act_for_child(f.requester_child_id)
            or public.actor_can_act_for_child(f.addressee_child_id)
          )
      )
      or exists (
        select 1
        from public.studio_friendships f
        where f.id = p_friendship_id
          and f.status = 'accepted'
          and (
            f.requester_user_id = auth.uid()
            or f.addressee_user_id = auth.uid()
          )
      )
    );
$$;

create or replace function public.purge_community_messages_for_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.community_messages where friendship_id = old.id;
    return old;
  end if;
  if new.status is distinct from 'accepted' then
    delete from public.community_messages where friendship_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists studio_friendships_purge_community
  on public.studio_friendships;
drop trigger if exists studio_friendships_purge_community_status
  on public.studio_friendships;
create trigger studio_friendships_purge_community_status
  after update of status on public.studio_friendships
  for each row execute procedure public.purge_community_messages_for_friendship();

drop trigger if exists studio_friendships_purge_community_delete
  on public.studio_friendships;
create trigger studio_friendships_purge_community_delete
  after delete on public.studio_friendships
  for each row execute procedure public.purge_community_messages_for_friendship();

drop trigger if exists child_friendships_purge_community_delete
  on public.child_friendships;
create trigger child_friendships_purge_community_delete
  after delete on public.child_friendships
  for each row execute procedure public.purge_community_messages_for_friendship();

-- Legacy email / invite-code adds are no longer the main path.
-- Parents must use studio parent-to-parent requests. A dancer login may
-- still send a child friendship, and only to another dancer at the same
-- approved studio.
create or replace function public.lookup_child_for_friend_request(
  p_email text,
  p_child_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := lower(trim(coalesce(p_child_name, '')));
  v_matches jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if (select p.role from public.profiles p where p.id = v_user) is distinct from 'dancer' then
    raise exception 'Add friends from your studio chat';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'child_id', c.id,
        'name', c.name
      )
      order by c.name
    ),
    '[]'::jsonb
  )
  into v_matches
  from public.children c
  where c.user_id <> v_user
    and (c.linked_user_id is null or c.linked_user_id <> v_user)
    and lower(trim(c.name)) = v_name
    and exists (
      select 1
      from public.children mine
      join public.studios s
        on s.id = mine.studio_id
       and s.status = 'approved'
      where mine.studio_id = c.studio_id
        and (
          mine.linked_user_id = v_user
          or mine.user_id = v_user
          or mine.id = (
            select pr.linked_child_id
            from public.profiles pr
            where pr.id = v_user
          )
        )
    )
    and (
      exists (
        select 1 from auth.users u
        where u.id = c.user_id
          and lower(coalesce(u.email, '')) = v_email
      )
      or exists (
        select 1 from auth.users u
        where u.id = c.linked_user_id
          and lower(coalesce(u.email, '')) = v_email
      )
    );

  return jsonb_build_object('matches', v_matches);
end;
$$;

create or replace function public.lookup_child_by_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := public.normalize_friend_invite_code(p_code);
  v_row record;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if (select p.role from public.profiles p where p.id = v_user) is distinct from 'dancer' then
    raise exception 'Add friends from your studio chat';
  end if;

  if v_code = '' then
    return jsonb_build_object('matches', '[]'::jsonb);
  end if;

  select c.id, c.name, c.user_id, c.linked_user_id, c.studio_id
  into v_row
  from public.child_friend_settings s
  join public.children c on c.id = s.child_id
  where s.invite_code = v_code;

  if not found
     or v_row.user_id = v_user
     or v_row.linked_user_id = v_user then
    return jsonb_build_object('matches', '[]'::jsonb);
  end if;

  if not exists (
    select 1
    from public.children mine
    join public.studios st
      on st.id = mine.studio_id
     and st.status = 'approved'
    where mine.studio_id = v_row.studio_id
      and (
        mine.linked_user_id = v_user
        or mine.user_id = v_user
        or mine.id = (
          select pr.linked_child_id
          from public.profiles pr
          where pr.id = v_user
        )
      )
  ) then
    return jsonb_build_object('matches', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'matches',
    jsonb_build_array(
      jsonb_build_object(
        'child_id', v_row.id,
        'name', v_row.name
      )
    )
  );
end;
$$;

create or replace function public.send_friend_request(
  p_from_child_id text,
  p_to_child_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_from public.children%rowtype;
  v_to public.children%rowtype;
  v_low text;
  v_high text;
  v_existing public.child_friendships%rowtype;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_user;

  if v_role = 'studio' then
    raise exception 'Studio accounts are not on the friend list';
  end if;

  if v_role is distinct from 'dancer' then
    raise exception 'Add friends from your studio chat';
  end if;

  if p_from_child_id is null or p_to_child_id is null
     or p_from_child_id = p_to_child_id then
    raise exception 'That is your own dancer';
  end if;

  select *
  into v_from
  from public.children
  where id = p_from_child_id
    and (user_id = v_user or linked_user_id = v_user);

  if not found then
    raise exception 'Not your dancer';
  end if;

  select *
  into v_to
  from public.children
  where id = p_to_child_id;

  if not found then
    raise exception 'Could not find that dancer';
  end if;

  if v_to.user_id = v_from.user_id
     or (v_to.linked_user_id is not null and v_to.linked_user_id = v_user) then
    raise exception 'That dancer is already in this family';
  end if;

  if v_from.studio_id is null
     or v_to.studio_id is distinct from v_from.studio_id
     or not exists (
       select 1
       from public.studios s
       where s.id = v_from.studio_id
         and s.status = 'approved'
     ) then
    raise exception 'You can only add dancers at the same studio';
  end if;

  v_low := least(p_from_child_id, p_to_child_id);
  v_high := greatest(p_from_child_id, p_to_child_id);

  select *
  into v_existing
  from public.child_friendships
  where child_low_id = v_low
    and child_high_id = v_high;

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'Already friends';
    end if;
    if v_existing.status = 'pending' then
      if v_existing.addressee_child_id = p_from_child_id then
        raise exception 'They already sent you a request';
      end if;
      raise exception 'Request already waiting';
    end if;

    update public.child_friendships
    set requester_child_id = p_from_child_id,
        requester_user_id = v_from.user_id,
        addressee_child_id = p_to_child_id,
        addressee_user_id = v_to.user_id,
        status = 'pending'
    where id = v_existing.id
    returning id into v_id;

    return jsonb_build_object(
      'ok', true,
      'status', 'pending',
      'friendship_id', v_id
    );
  end if;

  insert into public.child_friendships (
    child_low_id,
    child_high_id,
    requester_child_id,
    requester_user_id,
    addressee_child_id,
    addressee_user_id,
    status
  )
  values (
    v_low,
    v_high,
    p_from_child_id,
    v_from.user_id,
    p_to_child_id,
    v_to.user_id,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'pending',
    'friendship_id', v_id
  );
end;
$$;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.child_friendships%rowtype;
  v_from_studio uuid;
  v_to_studio uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_row
  from public.child_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that request';
  end if;

  if v_row.addressee_user_id <> v_user
     and not public.actor_can_act_for_child(v_row.addressee_child_id) then
    raise exception 'Not your request to answer';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'That request is no longer waiting';
  end if;

  if coalesce(p_accept, false) then
    select c.studio_id
    into v_from_studio
    from public.children c
    where c.id = v_row.requester_child_id;

    select c.studio_id
    into v_to_studio
    from public.children c
    where c.id = v_row.addressee_child_id;

    if v_from_studio is null
       or v_from_studio is distinct from v_to_studio
       or not exists (
         select 1
         from public.studios s
         where s.id = v_from_studio
           and s.status = 'approved'
       ) then
      raise exception 'You can only add dancers at the same studio';
    end if;
  end if;

  update public.child_friendships
  set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end
  where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when coalesce(p_accept, false) then 'accepted' else 'declined' end,
    'friendship_id', p_friendship_id
  );
end;
$$;

revoke all on function public.user_on_studio_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.accounts_are_parent_and_child(uuid, uuid) from public, anon, authenticated;
revoke all on function public.studio_friend_public_label(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.purge_community_messages_for_friendship() from public, anon, authenticated;

revoke all on function public.list_studio_friends(uuid) from public, anon;
grant execute on function public.list_studio_friends(uuid) to authenticated;

revoke all on function public.request_studio_friend(uuid, uuid) from public, anon;
grant execute on function public.request_studio_friend(uuid, uuid) to authenticated;

revoke all on function public.respond_studio_friend(uuid, boolean) from public, anon;
grant execute on function public.respond_studio_friend(uuid, boolean) to authenticated;

revoke all on function public.remove_studio_friend(uuid) from public, anon;
grant execute on function public.remove_studio_friend(uuid) to authenticated;

revoke all on function public.list_my_studio_friend_threads() from public, anon;
grant execute on function public.list_my_studio_friend_threads() to authenticated;

revoke all on function public.is_community_thread_member(uuid) from public, anon;
grant execute on function public.is_community_thread_member(uuid) to authenticated;
