-- My Dance Comps — kids friends
-- Run AFTER 20260921_family_accounts.sql in the Supabase SQL editor.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- Friendship is between child profiles. Parents send, accept, decline or
-- remove requests. Accepted friends may see each other's enrolled comps only
-- (not favourites, not date of birth). Direct table access stays own-row;
-- friend reads go through SECURITY DEFINER RPCs that return limited fields.
-- Shared enrolments use enrolled_by_child when that dancer has their own
-- set, otherwise the family-wide enrolled_comps list.

create table if not exists public.enrolled_by_child (
  user_id uuid not null references auth.users (id) on delete cascade,
  child_id text not null references public.children (id) on delete cascade,
  comp_id text not null,
  created_at timestamptz not null default now(),
  primary key (child_id, comp_id)
);

create table if not exists public.enrolled_child_sets (
  child_id text primary key references public.children (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade
);

create table if not exists public.child_friend_settings (
  child_id text primary key references public.children (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  share_enrolled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_friend_settings_user_id_idx
  on public.child_friend_settings (user_id);

create table if not exists public.child_friendships (
  id uuid primary key default gen_random_uuid(),
  child_low_id text not null references public.children (id) on delete cascade,
  child_high_id text not null references public.children (id) on delete cascade,
  requester_child_id text not null references public.children (id) on delete cascade,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  addressee_child_id text not null references public.children (id) on delete cascade,
  addressee_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_friendships_ordered check (child_low_id < child_high_id),
  constraint child_friendships_distinct check (child_low_id <> child_high_id),
  constraint child_friendships_pair unique (child_low_id, child_high_id)
);

create index if not exists child_friendships_requester_user_idx
  on public.child_friendships (requester_user_id);
create index if not exists child_friendships_addressee_user_idx
  on public.child_friendships (addressee_user_id);
create index if not exists child_friendships_requester_child_idx
  on public.child_friendships (requester_child_id);
create index if not exists child_friendships_addressee_child_idx
  on public.child_friendships (addressee_child_id);
create index if not exists child_friendships_status_idx
  on public.child_friendships (status);

drop trigger if exists child_friend_settings_set_updated_at
  on public.child_friend_settings;
create trigger child_friend_settings_set_updated_at
  before update on public.child_friend_settings
  for each row execute procedure public.set_updated_at();

drop trigger if exists child_friendships_set_updated_at
  on public.child_friendships;
create trigger child_friendships_set_updated_at
  before update on public.child_friendships
  for each row execute procedure public.set_updated_at();

alter table public.child_friend_settings enable row level security;
alter table public.child_friendships enable row level security;

drop policy if exists "friend_settings_select_own" on public.child_friend_settings;
drop policy if exists "friend_settings_insert_own" on public.child_friend_settings;
drop policy if exists "friend_settings_update_own" on public.child_friend_settings;
drop policy if exists "friend_settings_delete_own" on public.child_friend_settings;
create policy "friend_settings_select_own" on public.child_friend_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "friend_settings_insert_own" on public.child_friend_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "friend_settings_update_own" on public.child_friend_settings
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "friend_settings_delete_own" on public.child_friend_settings
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "friendships_select_participant" on public.child_friendships;
create policy "friendships_select_participant" on public.child_friendships
  for select to authenticated using (
    auth.uid() = requester_user_id or auth.uid() = addressee_user_id
  );

grant select, insert, update, delete on public.child_friend_settings to authenticated;
grant select on public.child_friendships to authenticated;

create or replace function public.generate_friend_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(
      alphabet,
      1 + floor(random() * length(alphabet))::int,
      1
    );
  end loop;
  return result;
end;
$$;

create or replace function public.normalize_friend_invite_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function public.ensure_child_friend_settings(p_child_id text)
returns public.child_friend_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.child_friend_settings;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and c.user_id = v_user
  ) then
    raise exception 'Not your dancer';
  end if;

  select * into v_row
  from public.child_friend_settings
  where child_id = p_child_id;

  if found then
    return v_row;
  end if;

  loop
    begin
      insert into public.child_friend_settings (child_id, user_id, invite_code)
      values (p_child_id, v_user, public.generate_friend_invite_code())
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

create or replace function public.friend_enrolled_comp_ids(p_child_id text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.id is null then '{}'::text[]
    when coalesce(s.share_enrolled, true) is not true then '{}'::text[]
    when exists (
      select 1 from public.enrolled_child_sets sets
      where sets.child_id = c.id
    ) then coalesce(
      (
        select array_agg(e.comp_id order by e.comp_id)
        from public.enrolled_by_child e
        where e.child_id = c.id
      ),
      '{}'::text[]
    )
    else coalesce(
      (
        select array_agg(e.comp_id order by e.comp_id)
        from public.enrolled_comps e
        where e.user_id = c.user_id
      ),
      '{}'::text[]
    )
  end
  from public.children c
  left join public.child_friend_settings s on s.child_id = c.id
  where c.id = p_child_id;
$$;

create or replace function public.list_friends_for_child(p_child_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
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
    and (f.requester_child_id = p_child_id or f.addressee_child_id = p_child_id)
    and (f.requester_user_id = v_user or f.addressee_user_id = v_user);

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
    and f.addressee_user_id = v_user
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
    and f.requester_user_id = v_user
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
  join auth.users u on u.id = c.user_id
  where c.user_id <> v_user
    and lower(coalesce(u.email, '')) = lower(trim(coalesce(p_email, '')))
    and lower(trim(c.name)) = lower(trim(coalesce(p_child_name, '')));

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

  select c.id, c.name, c.user_id
  into v_row
  from public.child_friend_settings s
  join public.children c on c.id = s.child_id
  where s.invite_code = v_code;

  if not found or v_row.user_id = v_user then
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
  where id = p_from_child_id and user_id = v_user;
  if not found then
    raise exception 'Not your dancer';
  end if;

  select * into v_to
  from public.children
  where id = p_to_child_id;
  if not found then
    raise exception 'Could not find that dancer';
  end if;

  if v_to.user_id = v_user then
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
      if v_existing.addressee_user_id = v_user then
        raise exception 'They already sent you a request';
      end if;
      raise exception 'Request already waiting';
    end if;
    -- declined: reopen as a new pending request from this parent
    update public.child_friendships
    set requester_child_id = p_from_child_id,
        requester_user_id = v_user,
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
    v_user,
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

  if v_row.addressee_user_id <> v_user then
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

  if v_row.requester_user_id <> v_user and v_row.addressee_user_id <> v_user then
    raise exception 'Not your friend to remove';
  end if;

  delete from public.child_friendships where id = p_friendship_id;

  return jsonb_build_object('ok', true, 'status', 'removed', 'friendship_id', p_friendship_id);
end;
$$;

create or replace function public.set_share_enrolled(
  p_child_id text,
  p_share boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.child_friend_settings;
begin
  v_settings := public.ensure_child_friend_settings(p_child_id);
  update public.child_friend_settings
  set share_enrolled = coalesce(p_share, true)
  where child_id = p_child_id
  returning * into v_settings;
  return jsonb_build_object(
    'ok', true,
    'share_enrolled', v_settings.share_enrolled
  );
end;
$$;

revoke all on function public.generate_friend_invite_code() from public, anon, authenticated;
revoke all on function public.normalize_friend_invite_code(text) from public, anon, authenticated;
revoke all on function public.friend_enrolled_comp_ids(text) from public, anon, authenticated;

revoke all on function public.ensure_child_friend_settings(text) from public, anon;
grant execute on function public.ensure_child_friend_settings(text) to authenticated;

revoke all on function public.list_friends_for_child(text) from public, anon;
grant execute on function public.list_friends_for_child(text) to authenticated;

revoke all on function public.lookup_child_for_friend_request(text, text) from public, anon;
grant execute on function public.lookup_child_for_friend_request(text, text) to authenticated;

revoke all on function public.lookup_child_by_friend_code(text) from public, anon;
grant execute on function public.lookup_child_by_friend_code(text) to authenticated;

revoke all on function public.send_friend_request(text, text) from public, anon;
grant execute on function public.send_friend_request(text, text) to authenticated;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.remove_friendship(uuid) to authenticated;

revoke all on function public.set_share_enrolled(text, boolean) from public, anon;
grant execute on function public.set_share_enrolled(text, boolean) to authenticated;
