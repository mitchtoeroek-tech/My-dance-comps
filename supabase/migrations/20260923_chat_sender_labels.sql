-- My Dance Comps — studio chat sender names
-- Run AFTER 20260922_studio_community_chat.sql in the Supabase SQL editor.
-- Safe to re-run.
--
-- No new column. A parent's own name is profiles.display_name, edited on
-- Account as "Your name (shown in chat)". sender_label already exists.
--
-- Dancer logins show as first name + surname initial (Mitch Test → Mitch T).
-- A single name stays as that first name (Mitch → Mitch). They never use
-- the parent-of template, including when profiles.role was left as parent
-- but the auth metadata or a linked child says dancer.
--
-- Parents show as "{First name}, parent of {dancer first names}"
-- (Sarah, parent of Evie and Harriet). Until a name is saved, the first
-- name slot is Parent.
--
-- Studio owners still show as the studio name. Emails are never used.
-- Existing studio messages are relabelled from current profiles and dancers.
-- Studio friend directory labels use the same function. Child-friend
-- threads still have no sender_label column.

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
  v_linked_child text;
  v_meta_role text;
  v_studio_name text;
  v_dancer_name text;
  v_clean text;
  v_parts text[];
  v_first text;
  v_last text;
  v_names text[];
  v_count int;
  v_parent text;
  v_kids text;
  v_is_dancer boolean := false;
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

  select
    p.role,
    nullif(btrim(p.display_name), ''),
    nullif(btrim(p.linked_child_id), '')
  into v_role, v_display, v_linked_child
  from public.profiles p
  where p.id = p_user;

  if v_display is not null and position('@' in v_display) > 0 then
    v_display := null;
  end if;

  v_is_dancer :=
    v_role = 'dancer'
    or v_linked_child is not null
    or exists (
      select 1
      from public.children c
      where c.linked_user_id = p_user
    );

  if not v_is_dancer then
    begin
      select u.raw_user_meta_data ->> 'role'
      into v_meta_role
      from auth.users u
      where u.id = p_user;
    exception
      when others then
        v_meta_role := null;
    end;
    if v_meta_role = 'dancer' then
      v_is_dancer := true;
    end if;
  end if;

  if v_is_dancer then
    select nullif(btrim(c.name), '')
    into v_dancer_name
    from public.children c
    where nullif(btrim(c.name), '') is not null
      and position('@' in c.name) = 0
      and (
        c.linked_user_id = p_user
        or (v_linked_child is not null and c.id = v_linked_child)
        or (
          c.user_id = p_user
          and c.linked_user_id is null
          and v_linked_child is null
          and not exists (
            select 1
            from public.children other
            where other.linked_user_id = p_user
          )
        )
      )
    order by
      case when c.studio_id is not distinct from p_studio_id then 0 else 1 end,
      c.created_at
    limit 1;

    v_clean := regexp_replace(
      btrim(coalesce(v_dancer_name, v_display, '')),
      '\s+',
      ' ',
      'g'
    );
    if v_clean = '' or position('@' in v_clean) > 0 then
      return 'Dancer';
    end if;
    if position(' ' in v_clean) = 0 then
      return left(v_clean, 80);
    end if;
    v_parts := regexp_split_to_array(v_clean, ' ');
    v_first := v_parts[1];
    v_last := v_parts[coalesce(cardinality(v_parts), 1)];
    if coalesce(v_first, '') = '' or coalesce(v_last, '') = '' then
      return left(v_clean, 80);
    end if;
    return left(v_first || ' ' || upper(left(v_last, 1)), 80);
  end if;

  select coalesce(array_agg(n order by n), '{}'::text[])
  into v_names
  from (
    select distinct split_part(
      regexp_replace(btrim(c.name), '\s+', ' ', 'g'),
      ' ',
      1
    ) as n
    from public.children c
    where c.studio_id = p_studio_id
      and c.user_id = p_user
      and nullif(btrim(c.name), '') is not null
      and position('@' in c.name) = 0
  ) names
  where nullif(n, '') is not null;

  v_count := coalesce(cardinality(v_names), 0);
  v_parent := nullif(
    split_part(
      regexp_replace(btrim(coalesce(v_display, '')), '\s+', ' ', 'g'),
      ' ',
      1
    ),
    ''
  );
  if v_parent is null or position('@' in v_parent) > 0 then
    v_parent := 'Parent';
  end if;

  if v_count = 1 then
    v_kids := v_names[1];
  elsif v_count = 2 then
    v_kids := v_names[1] || ' and ' || v_names[2];
  elsif v_count > 2 then
    v_kids := array_to_string(v_names[1:v_count - 1], ', ')
      || ' and '
      || v_names[v_count];
  else
    v_kids := null;
  end if;

  if v_kids is not null then
    return left(v_parent || ', parent of ' || v_kids, 160);
  end if;
  return left(v_parent, 80);
end;
$$;

revoke all on function public.studio_chat_sender_label(uuid, uuid) from public, anon, authenticated;

-- Studio friend lists and their DMs call this. Replace it when the
-- studio friendships SQL has already been applied, and define it if this
-- file is run first. Re-running studio friendships afterwards keeps this
-- wording, because that file delegates here too.
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

revoke all on function public.studio_friend_public_label(uuid, uuid, text) from public, anon, authenticated;

-- Dancer sign-ups whose profile row was created first keep role = parent
-- (the default) because handle_new_user does not overwrite an existing row.
-- Auth metadata still says dancer. Repair that before relabelling messages.
do $$
begin
  update public.profiles p
  set role = 'dancer'
  where p.role = 'parent'
    and not exists (
      select 1 from public.studios s where s.owner_id = p.id
    )
    and exists (
      select 1
      from auth.users u
      where u.id = p.id
        and u.raw_user_meta_data ->> 'role' = 'dancer'
    );
exception
  when undefined_table or undefined_column then
    raise notice 'Skip dancer role repair: %', sqlerrm;
end;
$$;

do $$
begin
  if to_regclass('public.studio_community_messages') is null then
    raise notice 'studio_community_messages is missing; skip label refresh';
    return;
  end if;

  update public.studio_community_messages m
  set sender_label = left(
    coalesce(
      nullif(btrim(public.studio_chat_sender_label(m.studio_id, m.sender_user_id)), ''),
      'Member'
    ),
    160
  );
end;
$$;
