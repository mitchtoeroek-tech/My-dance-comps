-- My Dance Comps — dancer logins and family link
-- Run AFTER 20260921_family_accounts.sql, 20260921_kids_friends.sql,
-- and 20260921_community_chat.sql in the Supabase SQL editor.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- Confirm email stays OFF in Supabase Auth. This file does not turn it on.
-- Existing accounts become role = parent. Child rows stay owned by the parent
-- (user_id). A dancer login sets children.linked_user_id. One dancer belongs
-- to one primary family. A second parent on the same family is a later stretch.
--
-- Friends and Community keep using child ids. A linked dancer can act for
-- their own child (send / accept friend requests, read that thread). Parents
-- still can, including for younger dancers who have no login.

alter table public.profiles
  add column if not exists role text not null default 'parent';

alter table public.profiles
  add column if not exists linked_child_id text;

alter table public.profiles
  add column if not exists username text;

alter table public.children
  add column if not exists linked_user_id uuid references auth.users (id) on delete set null;

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('parent', 'dancer'));
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists profiles_username_uidx
  on public.profiles (username)
  where username is not null;

create unique index if not exists children_linked_user_id_uidx
  on public.children (linked_user_id)
  where linked_user_id is not null;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists families_owner_user_id_idx
  on public.families (owner_user_id);

alter table public.profiles
  add column if not exists family_id uuid references public.families (id) on delete set null;

create index if not exists profiles_family_id_idx
  on public.profiles (family_id);

create table if not exists public.family_email_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  child_id text,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists family_email_invites_email_idx
  on public.family_email_invites (lower(email));

create unique index if not exists family_email_invites_pending_uidx
  on public.family_email_invites (family_id, lower(email))
  where status = 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := case
    when new.raw_user_meta_data ->> 'role' = 'dancer' then 'dancer'
    else 'parent'
  end;
  v_username text := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
begin
  insert into public.profiles (id, display_name, role, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    v_role,
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Client upserts must not be able to change role, family, or the linked child.
revoke update on public.profiles from authenticated;
grant update (
  id,
  display_name,
  selected_child_id,
  include_interstate,
  preferred_state,
  reminder_prefs,
  notified_reminder_ids
) on public.profiles to authenticated;

revoke insert on public.profiles from authenticated;
grant insert (
  id,
  display_name,
  selected_child_id,
  include_interstate,
  preferred_state,
  reminder_prefs,
  notified_reminder_ids
) on public.profiles to authenticated;

revoke update on public.children from authenticated;
grant update (
  id,
  user_id,
  name,
  dob,
  styles,
  studio,
  home_state
) on public.children to authenticated;

revoke insert on public.children from authenticated;
grant insert (
  id,
  user_id,
  name,
  dob,
  styles,
  studio,
  home_state
) on public.children to authenticated;

alter table public.families enable row level security;
alter table public.family_email_invites enable row level security;

drop policy if exists "families_select_member" on public.families;
create policy "families_select_member" on public.families
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or id in (
      select p.family_id from public.profiles p where p.id = auth.uid()
    )
  );

grant select on public.families to authenticated;
revoke insert, update, delete on public.families from authenticated;
revoke all on public.family_email_invites from authenticated;

create or replace function public.clear_dancer_link_on_child_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set family_id = null,
      linked_child_id = null
  where linked_child_id = old.id
     or id = old.linked_user_id;
  return old;
end;
$$;

drop trigger if exists children_clear_dancer_link on public.children;
create trigger children_clear_dancer_link
  before delete on public.children
  for each row execute procedure public.clear_dancer_link_on_child_delete();

create or replace function public.actor_can_act_for_child(p_child_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.children c
    where c.id = p_child_id
      and (
        c.user_id = auth.uid()
        or c.linked_user_id = auth.uid()
      )
  );
$$;

create or replace function public.ensure_child_friend_settings(p_child_id text)
returns public.child_friend_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_row public.child_friend_settings;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not public.actor_can_act_for_child(p_child_id) then
    raise exception 'Not your dancer';
  end if;

  select c.user_id into v_owner
  from public.children c
  where c.id = p_child_id;

  select * into v_row
  from public.child_friend_settings
  where child_id = p_child_id;

  if found then
    return v_row;
  end if;

  loop
    begin
      insert into public.child_friend_settings (child_id, user_id, invite_code)
      values (p_child_id, v_owner, public.generate_friend_invite_code())
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      select * into v_row
      from public.child_friend_settings
      where child_id = p_child_id;
      if found then
        return v_row;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.list_friends_for_child(p_child_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.child_friend_settings;
  v_friends jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
begin
  v_settings := public.ensure_child_friend_settings(p_child_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', other.id,
        'name', other.name,
        'enrolled_comp_ids', coalesce(public.friend_enrolled_comp_ids(other.id), '{}'::text[])
      )
      order by other.name
    ),
    '[]'::jsonb
  )
  into v_friends
  from public.child_friendships f
  join public.children other
    on other.id = case
      when f.requester_child_id = p_child_id then f.addressee_child_id
      else f.requester_child_id
    end
  where f.status = 'accepted'
    and (f.requester_child_id = p_child_id or f.addressee_child_id = p_child_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', c.id,
        'name', c.name
      )
      order by f.created_at
    ),
    '[]'::jsonb
  )
  into v_incoming
  from public.child_friendships f
  join public.children c on c.id = f.requester_child_id
  where f.addressee_child_id = p_child_id
    and f.status = 'pending';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', c.id,
        'name', c.name
      )
      order by f.created_at
    ),
    '[]'::jsonb
  )
  into v_outgoing
  from public.child_friendships f
  join public.children c on c.id = f.addressee_child_id
  where f.requester_child_id = p_child_id
    and f.status = 'pending';

  return jsonb_build_object(
    'invite_code', v_settings.invite_code,
    'share_enrolled', v_settings.share_enrolled,
    'friends', v_friends,
    'incoming', v_incoming,
    'outgoing', v_outgoing
  );
end;
$$;

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

  if v_code = '' then
    return jsonb_build_object('matches', '[]'::jsonb);
  end if;

  select c.id, c.name, c.user_id, c.linked_user_id
  into v_row
  from public.child_friend_settings s
  join public.children c on c.id = s.child_id
  where s.invite_code = v_code;

  if not found
     or v_row.user_id = v_user
     or v_row.linked_user_id = v_user then
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

  if p_from_child_id is null or p_to_child_id is null
     or p_from_child_id = p_to_child_id then
    raise exception 'That is your own dancer';
  end if;

  select * into v_from
  from public.children
  where id = p_from_child_id
    and (user_id = v_user or linked_user_id = v_user);
  if not found then
    raise exception 'Not your dancer';
  end if;

  select * into v_to
  from public.children
  where id = p_to_child_id;
  if not found then
    raise exception 'Could not find that dancer';
  end if;

  if v_to.user_id = v_from.user_id
     or (v_to.linked_user_id is not null and v_to.linked_user_id = v_user) then
    raise exception 'That dancer is already in this family';
  end if;

  v_low := least(p_from_child_id, p_to_child_id);
  v_high := greatest(p_from_child_id, p_to_child_id);

  select * into v_existing
  from public.child_friendships
  where child_low_id = v_low and child_high_id = v_high;

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
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
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

  update public.child_friendships
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when p_accept then 'accepted' else 'declined' end,
    'friendship_id', p_friendship_id
  );
end;
$$;

create or replace function public.remove_friendship(p_friendship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.child_friendships%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.child_friendships
  where id = p_friendship_id;
  if not found then
    raise exception 'Could not find that friend';
  end if;

  if v_row.requester_user_id <> v_user
     and v_row.addressee_user_id <> v_user
     and not public.actor_can_act_for_child(v_row.requester_child_id)
     and not public.actor_can_act_for_child(v_row.addressee_child_id) then
    raise exception 'Not your friend to remove';
  end if;

  delete from public.child_friendships where id = p_friendship_id;

  return jsonb_build_object('ok', true, 'status', 'removed', 'friendship_id', p_friendship_id);
end;
$$;

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
        or public.actor_can_act_for_child(f.requester_child_id)
        or public.actor_can_act_for_child(f.addressee_child_id)
      )
  );
$$;

-- Move a dancer login onto a parent-owned child row. Copies enrolments and
-- results from any child rows the dancer still owns, then removes those rows.
create or replace function public.link_dancer_account(
  p_dancer uuid,
  p_owner uuid,
  p_family uuid,
  p_child_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_id text := nullif(trim(coalesce(p_child_id, '')), '');
  v_source public.children%rowtype;
  v_name text;
begin
  if exists (
    select 1 from public.profiles
    where id = p_dancer and family_id is not null
  ) then
    raise exception 'This dancer is already in a family';
  end if;

  if exists (
    select 1 from public.children where linked_user_id = p_dancer
  ) then
    raise exception 'This dancer is already in a family';
  end if;

  if v_child_id is not null then
    if not exists (
      select 1 from public.children c
      where c.id = v_child_id
        and c.user_id = p_owner
        and c.linked_user_id is null
    ) then
      raise exception 'That dancer profile is not available to link';
    end if;
    update public.children
    set linked_user_id = p_dancer
    where id = v_child_id;
  else
    select * into v_source
    from public.children
    where user_id = p_dancer
    order by created_at
    limit 1;

    v_name := coalesce(
      nullif(trim(v_source.name), ''),
      nullif(trim((select display_name from public.profiles where id = p_dancer)), ''),
      'Dancer'
    );

    v_child_id := gen_random_uuid()::text;
    insert into public.children (
      id, user_id, name, dob, styles, studio, home_state, linked_user_id
    )
    values (
      v_child_id,
      p_owner,
      v_name,
      coalesce(v_source.dob, ''),
      coalesce(v_source.styles, '{}'::text[]),
      coalesce(v_source.studio, ''),
      coalesce(nullif(v_source.home_state, ''), 'SA'),
      p_dancer
    );
  end if;

  if exists (
    select 1
    from public.enrolled_by_child e
    join public.children c on c.id = e.child_id
    where c.user_id = p_dancer
  ) or exists (
    select 1 from public.enrolled_comps e where e.user_id = p_dancer
  ) then
    if not exists (
      select 1 from public.enrolled_child_sets s where s.child_id = v_child_id
    ) then
      insert into public.enrolled_by_child (user_id, child_id, comp_id)
      select p_owner, v_child_id, e.comp_id
      from public.enrolled_comps e
      where e.user_id = p_owner
      on conflict (child_id, comp_id) do nothing;
    end if;

    insert into public.enrolled_by_child (user_id, child_id, comp_id)
    select p_owner, v_child_id, e.comp_id
    from public.enrolled_by_child e
    join public.children c on c.id = e.child_id
    where c.user_id = p_dancer
    on conflict (child_id, comp_id) do nothing;

    insert into public.enrolled_by_child (user_id, child_id, comp_id)
    select p_owner, v_child_id, e.comp_id
    from public.enrolled_comps e
    where e.user_id = p_dancer
    on conflict (child_id, comp_id) do nothing;

    insert into public.enrolled_child_sets (child_id, user_id)
    values (v_child_id, p_owner)
    on conflict (child_id) do nothing;
  end if;

  update public.results
  set user_id = p_owner,
      child_id = v_child_id
  where user_id = p_dancer;

  delete from public.enrolled_comps where user_id = p_dancer;
  delete from public.children where user_id = p_dancer;

  update public.profiles
  set family_id = p_family,
      linked_child_id = v_child_id,
      role = 'dancer'
  where id = p_dancer;

  return v_child_id;
end;
$$;

create or replace function public.detach_linked_dancer(p_child_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dancer uuid;
begin
  select linked_user_id into v_dancer
  from public.children
  where id = p_child_id;

  if v_dancer is null then
    raise exception 'That dancer does not have their own login';
  end if;

  update public.children
  set user_id = v_dancer,
      linked_user_id = null
  where id = p_child_id;

  update public.results
  set user_id = v_dancer
  where child_id = p_child_id;

  update public.enrolled_by_child
  set user_id = v_dancer
  where child_id = p_child_id;

  update public.enrolled_child_sets
  set user_id = v_dancer
  where child_id = p_child_id;

  update public.child_friend_settings
  set user_id = v_dancer
  where child_id = p_child_id;

  update public.profiles
  set family_id = null,
      linked_child_id = null
  where id = v_dancer;
end;
$$;

create or replace function public.ensure_family()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_family uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select role, family_id into v_role, v_family
  from public.profiles
  where id = v_user;

  if coalesce(v_role, 'parent') = 'dancer' then
    raise exception 'Parents create the family code';
  end if;

  if v_family is not null then
    select invite_code into v_code from public.families where id = v_family;
    return jsonb_build_object(
      'ok', true,
      'family_id', v_family,
      'invite_code', v_code
    );
  end if;

  loop
    begin
      insert into public.families (owner_user_id, invite_code)
      values (v_user, public.generate_friend_invite_code())
      returning id, invite_code into v_family, v_code;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  update public.profiles
  set family_id = v_family
  where id = v_user;

  return jsonb_build_object(
    'ok', true,
    'family_id', v_family,
    'invite_code', v_code
  );
end;
$$;

create or replace function public.preview_family_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := public.normalize_friend_invite_code(p_code);
  v_family public.families%rowtype;
  v_label text;
  v_dancers jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_code = '' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_family
  from public.families
  where invite_code = v_code;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Your parent')
  into v_label
  from public.profiles
  where id = v_family.owner_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'linked', c.linked_user_id is not null
      )
      order by c.name
    ),
    '[]'::jsonb
  )
  into v_dancers
  from public.children c
  where c.user_id = v_family.owner_user_id;

  return jsonb_build_object(
    'ok', true,
    'family_name', v_label,
    'dancers', v_dancers
  );
end;
$$;

create or replace function public.join_family(
  p_code text,
  p_child_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_code text := public.normalize_friend_invite_code(p_code);
  v_family public.families%rowtype;
  v_child text;
  v_email text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user;
  if v_role is distinct from 'dancer' then
    raise exception 'Only a dancer account can join a family with a code';
  end if;

  select * into v_family
  from public.families
  where invite_code = v_code;
  if not found then
    raise exception 'That family code was not recognised';
  end if;

  if v_family.owner_user_id = v_user then
    raise exception 'That family code belongs to this account';
  end if;

  v_child := public.link_dancer_account(
    v_user,
    v_family.owner_user_id,
    v_family.id,
    p_child_id
  );

  select lower(coalesce(email, '')) into v_email
  from auth.users
  where id = v_user;

  update public.family_email_invites
  set status = 'accepted'
  where family_id = v_family.id
    and status = 'pending'
    and lower(email) = v_email;

  return jsonb_build_object('ok', true, 'child_id', v_child, 'family_id', v_family.id);
end;
$$;

create or replace function public.invite_dancer_by_email(
  p_email text,
  p_child_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_child text := nullif(trim(coalesce(p_child_id, '')), '');
  v_existing uuid;
  v_existing_role text;
  v_existing_family uuid;
  v_linked text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter the dancer''s email address';
  end if;

  if v_email like '%@dancers.mydancecomps.app' then
    raise exception 'Username logins join with the family code';
  end if;

  select family_id into v_family from public.profiles where id = v_user;
  if v_family is null then
    v_family := (public.ensure_family() ->> 'family_id')::uuid;
  end if;

  if not exists (
    select 1 from public.families
    where id = v_family and owner_user_id = v_user
  ) then
    raise exception 'Only the parent who created the family can invite';
  end if;

  if v_child is not null then
    if not exists (
      select 1 from public.children c
      where c.id = v_child and c.user_id = v_user and c.linked_user_id is null
    ) then
      raise exception 'That dancer profile is not available to link';
    end if;
  end if;

  select u.id, p.role, p.family_id
  into v_existing, v_existing_role, v_existing_family
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.email, '')) = v_email
  limit 1;

  if v_existing is not null then
    if coalesce(v_existing_role, 'parent') <> 'dancer' then
      raise exception 'That email is a parent account';
    end if;
    if v_existing_family is not null then
      raise exception 'This dancer is already in a family';
    end if;
    v_linked := public.link_dancer_account(v_existing, v_user, v_family, v_child);
    update public.family_email_invites
    set status = 'accepted'
    where family_id = v_family
      and status = 'pending'
      and lower(email) = v_email;
    return jsonb_build_object('ok', true, 'status', 'linked', 'child_id', v_linked);
  end if;

  insert into public.family_email_invites (family_id, email, child_id, invited_by, status)
  values (v_family, v_email, v_child, v_user, 'pending')
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

create or replace function public.claim_family_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_family uuid;
  v_email text;
  v_invite public.family_email_invites%rowtype;
  v_owner uuid;
  v_child text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'status', 'signed-out');
  end if;

  select role, family_id into v_role, v_family
  from public.profiles
  where id = v_user;

  if v_role is distinct from 'dancer' or v_family is not null then
    return jsonb_build_object('ok', true, 'status', 'skipped');
  end if;

  select lower(coalesce(email, '')) into v_email
  from auth.users
  where id = v_user;

  if v_email = '' or v_email like '%@dancers.mydancecomps.app' then
    return jsonb_build_object('ok', true, 'status', 'skipped');
  end if;

  select * into v_invite
  from public.family_email_invites
  where status = 'pending'
    and lower(email) = v_email
  order by created_at
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'status', 'none');
  end if;

  select owner_user_id into v_owner
  from public.families
  where id = v_invite.family_id;

  v_child := public.link_dancer_account(
    v_user,
    v_owner,
    v_invite.family_id,
    v_invite.child_id
  );

  update public.family_email_invites
  set status = case when id = v_invite.id then 'accepted' else 'cancelled' end
  where status = 'pending'
    and lower(email) = v_email;

  return jsonb_build_object('ok', true, 'status', 'linked', 'child_id', v_child);
end;
$$;

create or replace function public.unlink_dancer(p_child_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.children
    where id = p_child_id and user_id = v_user and linked_user_id is not null
  ) then
    raise exception 'That dancer does not have their own login';
  end if;

  perform public.detach_linked_dancer(p_child_id);
  return jsonb_build_object('ok', true, 'status', 'unlinked');
end;
$$;

create or replace function public.leave_family()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_child text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_child
  from public.children
  where linked_user_id = v_user
  limit 1;

  if v_child is null then
    raise exception 'You are not in a family yet';
  end if;

  perform public.detach_linked_dancer(v_child);
  return jsonb_build_object('ok', true, 'status', 'left');
end;
$$;

create or replace function public.dancer_pull_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_child public.children%rowtype;
  v_owned boolean := false;
  v_ids text[];
  v_results jsonb;
  v_favs text[];
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found
     or v_profile.role is distinct from 'dancer'
     or v_profile.linked_child_id is null then
    return jsonb_build_object('linked', false);
  end if;

  select * into v_child
  from public.children
  where id = v_profile.linked_child_id
    and linked_user_id = v_user;

  if not found then
    return jsonb_build_object('linked', false);
  end if;

  v_owned := exists (
    select 1 from public.enrolled_child_sets s where s.child_id = v_child.id
  );

  if v_owned then
    select coalesce(array_agg(e.comp_id order by e.comp_id), '{}'::text[])
    into v_ids
    from public.enrolled_by_child e
    where e.child_id = v_child.id;
  else
    select coalesce(array_agg(e.comp_id order by e.comp_id), '{}'::text[])
    into v_ids
    from public.enrolled_comps e
    where e.user_id = v_child.user_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'comp_id', r.comp_id,
        'comp_name', r.comp_name,
        'date', r.date,
        'section', r.section,
        'placing', r."placing",
        'score', r.score,
        'notes', r.notes
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_results
  from public.results r
  where r.child_id = v_child.id;

  select coalesce(array_agg(f.comp_id), '{}'::text[])
  into v_favs
  from public.favourites f
  where f.user_id = v_user;

  return jsonb_build_object(
    'linked', true,
    'child', jsonb_build_object(
      'id', v_child.id,
      'name', v_child.name,
      'dob', v_child.dob,
      'styles', to_jsonb(v_child.styles),
      'studio', v_child.studio,
      'home_state', v_child.home_state,
      'linked_user_id', v_child.linked_user_id
    ),
    'enrolled_owned', v_owned,
    'enrolled_ids', to_jsonb(coalesce(v_ids, '{}'::text[])),
    'results', v_results,
    'favourites', to_jsonb(coalesce(v_favs, '{}'::text[])),
    'include_interstate', coalesce(v_profile.include_interstate, false),
    'preferred_state', v_profile.preferred_state,
    'reminder_prefs', coalesce(v_profile.reminder_prefs, '{}'::jsonb),
    'notified_reminder_ids', to_jsonb(coalesce(v_profile.notified_reminder_ids, '{}'::text[]))
  );
end;
$$;

create or replace function public.dancer_push_state(p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_child public.children%rowtype;
  v_name text;
  v_styles text[];
  v_home text;
  v_owned boolean;
  v_ids text[];
  v_comp text;
  v_result jsonb;
  v_result_ids text[] := '{}'::text[];
  v_fav text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if v_profile.role is distinct from 'dancer' or v_profile.linked_child_id is null then
    raise exception 'Join a family before saving';
  end if;

  select * into v_child
  from public.children
  where id = v_profile.linked_child_id
    and linked_user_id = v_user;
  if not found then
    raise exception 'Join a family before saving';
  end if;

  v_name := nullif(trim(coalesce(p_state #>> '{child,name}', '')), '');
  if v_name is null then
    raise exception 'Add the dancer''s name';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into v_styles
  from jsonb_array_elements_text(coalesce(p_state #> '{child,styles}', '[]'::jsonb));

  v_home := upper(trim(coalesce(p_state #>> '{child,home_state}', 'SA')));
  if v_home not in ('SA', 'VIC', 'NSW', 'QLD', 'WA', 'TAS', 'NT', 'ACT') then
    v_home := 'SA';
  end if;

  update public.children
  set name = left(v_name, 80),
      dob = left(coalesce(p_state #>> '{child,dob}', ''), 32),
      styles = v_styles,
      studio = left(coalesce(p_state #>> '{child,studio}', ''), 120),
      home_state = v_home
  where id = v_child.id;

  update public.profiles
  set include_interstate = coalesce((p_state ->> 'include_interstate')::boolean, false),
      preferred_state = case
        when coalesce(p_state ->> 'preferred_state', '') in ('SA', 'VIC', 'NSW', 'QLD', 'WA', 'TAS', 'NT', 'ACT')
          then p_state ->> 'preferred_state'
        else preferred_state
      end,
      reminder_prefs = coalesce(p_state -> 'reminder_prefs', reminder_prefs),
      notified_reminder_ids = coalesce(
        (
          select array_agg(value)
          from jsonb_array_elements_text(coalesce(p_state -> 'notified_reminder_ids', '[]'::jsonb))
        ),
        '{}'::text[]
      ),
      selected_child_id = v_child.id
  where id = v_user;

  delete from public.favourites where user_id = v_user;
  for v_fav in
    select value
    from jsonb_array_elements_text(coalesce(p_state -> 'favourites', '[]'::jsonb))
  loop
    insert into public.favourites (user_id, comp_id)
    values (v_user, v_fav)
    on conflict do nothing;
  end loop;

  v_owned := coalesce((p_state ->> 'enrolled_owned')::boolean, false);
  if v_owned then
    select coalesce(array_agg(distinct value), '{}'::text[])
    into v_ids
    from jsonb_array_elements_text(coalesce(p_state -> 'enrolled_ids', '[]'::jsonb));

    delete from public.enrolled_by_child where child_id = v_child.id;
    if v_ids is not null then
      foreach v_comp in array v_ids loop
        insert into public.enrolled_by_child (user_id, child_id, comp_id)
        values (v_child.user_id, v_child.id, v_comp)
        on conflict do nothing;
      end loop;
    end if;
    insert into public.enrolled_child_sets (child_id, user_id)
    values (v_child.id, v_child.user_id)
    on conflict (child_id) do update set user_id = excluded.user_id;
  end if;

  for v_result in
    select value
    from jsonb_array_elements(coalesce(p_state -> 'results', '[]'::jsonb))
  loop
    if nullif(v_result ->> 'id', '') is null then
      continue;
    end if;
    v_result_ids := array_append(v_result_ids, v_result ->> 'id');
    insert into public.results (
      id, user_id, child_id, comp_id, comp_name, date, section, "placing", score, notes
    )
    values (
      v_result ->> 'id',
      v_child.user_id,
      v_child.id,
      nullif(v_result ->> 'comp_id', ''),
      coalesce(nullif(v_result ->> 'comp_name', ''), 'Competition'),
      coalesce(v_result ->> 'date', ''),
      coalesce(v_result ->> 'section', ''),
      coalesce(v_result ->> 'placing', ''),
      coalesce(v_result ->> 'score', ''),
      coalesce(v_result ->> 'notes', '')
    )
    on conflict (id) do update set
      user_id = excluded.user_id,
      child_id = excluded.child_id,
      comp_id = excluded.comp_id,
      comp_name = excluded.comp_name,
      date = excluded.date,
      section = excluded.section,
      "placing" = excluded."placing",
      score = excluded.score,
      notes = excluded.notes
    where public.results.child_id = v_child.id;
  end loop;

  delete from public.results
  where child_id = v_child.id
    and id <> all (v_result_ids);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.actor_can_act_for_child(text) from public, anon, authenticated;
revoke all on function public.link_dancer_account(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.detach_linked_dancer(text) from public, anon, authenticated;
revoke all on function public.clear_dancer_link_on_child_delete() from public, anon, authenticated;

revoke all on function public.ensure_family() from public, anon;
grant execute on function public.ensure_family() to authenticated;

revoke all on function public.preview_family_code(text) from public, anon;
grant execute on function public.preview_family_code(text) to authenticated;

revoke all on function public.join_family(text, text) from public, anon;
grant execute on function public.join_family(text, text) to authenticated;

revoke all on function public.invite_dancer_by_email(text, text) from public, anon;
grant execute on function public.invite_dancer_by_email(text, text) to authenticated;

revoke all on function public.claim_family_invites() from public, anon;
grant execute on function public.claim_family_invites() to authenticated;

revoke all on function public.unlink_dancer(text) from public, anon;
grant execute on function public.unlink_dancer(text) to authenticated;

revoke all on function public.leave_family() from public, anon;
grant execute on function public.leave_family() to authenticated;

revoke all on function public.dancer_pull_state() from public, anon;
grant execute on function public.dancer_pull_state() to authenticated;

revoke all on function public.dancer_push_state(jsonb) from public, anon;
grant execute on function public.dancer_push_state(jsonb) to authenticated;
