-- My Dance Comps — sibling dancer friends
-- Run AFTER 20260923_studio_friendships.sql in the Supabase SQL editor.
-- Safe to re-run: functions are created or replaced idempotently.
--
-- Two dancer logins in the same family (same profiles.family_id, each linked
-- to their own child profile) can friend each other and use friend DMs.
-- They do not have to share a studio.
--
-- Still enforced:
--   * parents add parents, dancers add dancers
--   * a parent and a child cannot be friends
--   * a sibling pair is role = dancer on both sides
--   * sibling chats are only the two dancer logins (not the parent account)
--
-- The row is a child_friendships pair between the two linked child profiles,
-- so existing Community DMs apply. Studio friendships are unchanged for
-- same-studio friends, and the studio directory marks a same-family dancer
-- so the button can say "Add sibling".

create or replace function public.profiles_are_sibling_dancers(
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
    and not public.accounts_are_parent_and_child(p_a, p_b)
    and exists (
      select 1
      from public.profiles pa
      join public.profiles pb on pb.id = p_b
      where pa.id = p_a
        and pa.role = 'dancer'
        and pb.role = 'dancer'
        and pa.family_id is not null
        and pa.family_id = pb.family_id
        and pa.linked_child_id is not null
        and pb.linked_child_id is not null
        and pa.linked_child_id <> pb.linked_child_id
        and exists (
          select 1
          from public.children c
          where c.id = pa.linked_child_id
            and c.linked_user_id = pa.id
        )
        and exists (
          select 1
          from public.children c
          where c.id = pb.linked_child_id
            and c.linked_user_id = pb.id
        )
    );
$$;

create or replace function public.child_friendship_is_sibling_pair(
  p_child_a text,
  p_child_b text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profiles_are_sibling_dancers(
    (select c.linked_user_id from public.children c where c.id = p_child_a),
    (select c.linked_user_id from public.children c where c.id = p_child_b)
  );
$$;

create or replace function public.sibling_public_label(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select nullif(split_part(btrim(c.name), ' ', 1), '')
  into v_name
  from public.children c
  join public.profiles p on p.id = p_user and p.linked_child_id = c.id
  where position('@' in c.name) = 0
  limit 1;

  if v_name is null or position('@' in v_name) > 0 then
    return 'Dancer';
  end if;
  return left(v_name, 80);
end;
$$;

create or replace function public.list_family_siblings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_family uuid;
  v_child text;
  v_suggest jsonb;
  v_incoming jsonb;
  v_outgoing jsonb;
  v_friends jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select p.role, p.family_id, p.linked_child_id
  into v_role, v_family, v_child
  from public.profiles p
  where p.id = v_user;

  if v_role is distinct from 'dancer'
     or v_family is null
     or v_child is null
     or not exists (
       select 1
       from public.children c
       where c.id = v_child
         and c.linked_user_id = v_user
     ) then
    return jsonb_build_object(
      'can_add', false,
      'viewer_role', case
        when v_role in ('parent', 'dancer', 'studio') then v_role
        else 'none'
      end,
      'suggest', '[]'::jsonb,
      'incoming', '[]'::jsonb,
      'outgoing', '[]'::jsonb,
      'friends', '[]'::jsonb
    );
  end if;

  with people as (
    select
      p.id as user_id,
      public.sibling_public_label(p.id) as label,
      p.linked_child_id as child_id
    from public.profiles p
    where public.profiles_are_sibling_dancers(v_user, p.id)
  ),
  links as (
    select
      people.user_id,
      people.label,
      f.id as friendship_id,
      f.status,
      f.requester_child_id,
      f.addressee_child_id
    from people
    left join public.child_friendships f
      on f.child_low_id = least(v_child, people.child_id)
     and f.child_high_id = greatest(v_child, people.child_id)
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
        and addressee_child_id = v_child
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
        and requester_child_id = v_child
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
    'can_add', true,
    'viewer_role', 'dancer',
    'suggest', v_suggest,
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'friends', v_friends
  );
end;
$$;

create or replace function public.request_sibling_friend(p_other_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_other_role text;
  v_from text;
  v_to text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_user then
    raise exception 'That is you';
  end if;

  select p.role, p.linked_child_id
  into v_role, v_from
  from public.profiles p
  where p.id = v_user;

  if v_role is distinct from 'dancer' or v_from is null then
    raise exception 'Siblings must both be dancer logins';
  end if;

  select p.role, p.linked_child_id
  into v_other_role, v_to
  from public.profiles p
  where p.id = p_other_user_id;

  if public.accounts_are_parent_and_child(v_user, p_other_user_id)
     or v_other_role is distinct from 'dancer' then
    if v_other_role = 'parent' or public.accounts_are_parent_and_child(v_user, p_other_user_id) then
      raise exception 'Parents and dancers cannot be friends';
    end if;
    raise exception 'Siblings must both be dancer logins';
  end if;

  if not public.profiles_are_sibling_dancers(v_user, p_other_user_id) then
    raise exception 'You can only add a sibling in your family';
  end if;

  return public.send_friend_request(v_from, v_to);
end;
$$;

-- Same-studio dancer friends stay as they are. A sibling pair skips the
-- same-family and same-studio blocks, and the friendship is owned by the
-- two dancer logins rather than the parent account.
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
  v_sibling boolean := false;
  v_requester uuid;
  v_addressee uuid;
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

  v_sibling := public.child_friendship_is_sibling_pair(p_from_child_id, p_to_child_id);

  if v_sibling then
    if v_from.linked_user_id is distinct from v_user
       or v_to.linked_user_id is null then
      raise exception 'Siblings must both be dancer logins';
    end if;
    if public.accounts_are_parent_and_child(v_user, v_to.linked_user_id) then
      raise exception 'Parents and dancers cannot be friends';
    end if;
    v_requester := v_user;
    v_addressee := v_to.linked_user_id;
  else
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

    v_requester := v_from.user_id;
    v_addressee := v_to.user_id;
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
        requester_user_id = v_requester,
        addressee_child_id = p_to_child_id,
        addressee_user_id = v_addressee,
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
    v_requester,
    p_to_child_id,
    v_addressee,
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
  v_sibling boolean := false;
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

  if v_row.status <> 'pending' then
    raise exception 'That request is no longer waiting';
  end if;

  v_sibling := public.child_friendship_is_sibling_pair(
    v_row.requester_child_id,
    v_row.addressee_child_id
  );

  if v_sibling then
    if not exists (
      select 1
      from public.children c
      where c.id = v_row.addressee_child_id
        and c.linked_user_id = v_user
    ) then
      raise exception 'Not your request to answer';
    end if;
  else
    if v_row.addressee_user_id <> v_user
       and not public.actor_can_act_for_child(v_row.addressee_child_id) then
      raise exception 'Not your request to answer';
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

  select *
  into v_row
  from public.child_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that friend';
  end if;

  if public.child_friendship_is_sibling_pair(
    v_row.requester_child_id,
    v_row.addressee_child_id
  ) then
    if not exists (
      select 1
      from public.children c
      where c.id in (v_row.requester_child_id, v_row.addressee_child_id)
        and c.linked_user_id = v_user
    ) then
      raise exception 'Not your friend to remove';
    end if;
  elsif v_row.requester_user_id <> v_user
     and v_row.addressee_user_id <> v_user
     and not public.actor_can_act_for_child(v_row.requester_child_id)
     and not public.actor_can_act_for_child(v_row.addressee_child_id) then
    raise exception 'Not your friend to remove';
  end if;

  delete from public.child_friendships where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'removed',
    'friendship_id', p_friendship_id
  );
end;
$$;

-- Parents who own both child rows must not read a sibling DM. Membership for
-- a sibling pair is the two linked dancer logins only.
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
            (
              public.child_friendship_is_sibling_pair(
                f.requester_child_id,
                f.addressee_child_id
              )
              and exists (
                select 1
                from public.children c
                where c.id in (f.requester_child_id, f.addressee_child_id)
                  and c.linked_user_id = auth.uid()
              )
            )
            or (
              not public.child_friendship_is_sibling_pair(
                f.requester_child_id,
                f.addressee_child_id
              )
              and (
                f.requester_user_id = auth.uid()
                or f.addressee_user_id = auth.uid()
                or public.actor_can_act_for_child(f.requester_child_id)
                or public.actor_can_act_for_child(f.addressee_child_id)
              )
            )
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
  v_viewer_is_dancer boolean;
begin
  v_settings := public.ensure_child_friend_settings(p_child_id);

  v_viewer_is_dancer := exists (
    select 1
    from public.children viewer_child
    where viewer_child.id = p_child_id
      and viewer_child.linked_user_id = auth.uid()
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', other.id,
        'name', case
          when public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
            then public.sibling_public_label(other.linked_user_id)
          else other.name
        end,
        'sibling', public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id),
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
    and (
      v_viewer_is_dancer
      or not public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', c.id,
        'name', case
          when public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
            then public.sibling_public_label(c.linked_user_id)
          else c.name
        end,
        'sibling', public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
      )
      order by f.created_at
    ),
    '[]'::jsonb
  )
  into v_incoming
  from public.child_friendships f
  join public.children c on c.id = f.requester_child_id
  where f.addressee_child_id = p_child_id
    and f.status = 'pending'
    and (
      v_viewer_is_dancer
      or not public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'friendship_id', f.id,
        'child_id', c.id,
        'name', case
          when public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
            then public.sibling_public_label(c.linked_user_id)
          else c.name
        end,
        'sibling', public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
      )
      order by f.created_at
    ),
    '[]'::jsonb
  )
  into v_outgoing
  from public.child_friendships f
  join public.children c on c.id = f.addressee_child_id
  where f.requester_child_id = p_child_id
    and f.status = 'pending'
    and (
      v_viewer_is_dancer
      or not public.child_friendship_is_sibling_pair(f.requester_child_id, f.addressee_child_id)
    );

  return jsonb_build_object(
    'invite_code', v_settings.invite_code,
    'share_enrolled', v_settings.share_enrolled,
    'friends', v_friends,
    'incoming', v_incoming,
    'outgoing', v_outgoing
  );
end;
$$;

-- Mark same-family dancers on the studio directory. Adding them there is
-- still a same-studio friendship. Family siblings who do not share a studio
-- use list_family_siblings / request_sibling_friend instead.
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
      public.studio_friend_public_label(p_studio_id, p.id, v_role) as label,
      public.profiles_are_sibling_dancers(v_user, p.id) as sibling
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
      people.sibling,
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
        jsonb_build_object(
          'user_id', user_id,
          'label', label,
          'sibling', sibling
        )
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
          'friendship_id', friendship_id,
          'sibling', sibling
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
          'friendship_id', friendship_id,
          'sibling', sibling
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
          'friendship_id', friendship_id,
          'sibling', sibling
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

revoke all on function public.profiles_are_sibling_dancers(uuid, uuid) from public, anon, authenticated;
revoke all on function public.child_friendship_is_sibling_pair(text, text) from public, anon, authenticated;
revoke all on function public.sibling_public_label(uuid) from public, anon, authenticated;

revoke all on function public.list_family_siblings() from public, anon;
grant execute on function public.list_family_siblings() to authenticated;

revoke all on function public.request_sibling_friend(uuid) from public, anon;
grant execute on function public.request_sibling_friend(uuid) to authenticated;
