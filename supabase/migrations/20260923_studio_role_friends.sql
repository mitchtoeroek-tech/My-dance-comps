-- My Dance Comps — same-studio, role-locked friends
-- Run AFTER 20260922_studio_community_chat.sql in the Supabase SQL editor.
-- Safe to re-run.
--
-- Friends are no longer an open email / invite-code search.
--   * Parent accounts can only be friends with other parents who have a
--     dancer at the same approved studio (public.parent_friendships).
--   * Dancer accounts can only be friends with other dancers at that studio
--     (public.child_friendships, now stamped with studio_id).
--   * Parent ↔ dancer friendships are rejected.
--   * Studio accounts cannot add friends here.
--
-- Enforcement is a BEFORE INSERT/UPDATE trigger. Security-definer RPCs run
-- as the table owner and bypass row-level security, so the trigger is what
-- actually blocks a bad write. RLS policies repeat the same rule for any
-- direct insert by an authenticated user (insert is not granted).
--
-- What happens to existing child_friendships when you run this:
--   * Same approved studio, both sides owned by parent accounts → copied into
--     parent_friendships. The friendship id is kept when it is the one we
--     retain, so existing Community threads stay attached. Duplicate pairs
--     (two dancers, same two parents, same studio) collapse onto one id.
--   * Same approved studio, both sides already dancer accounts → kept on
--     child_friendships with studio_id set.
--   * Different studios, a missing studio, or a parent↔dancer pair → declined.
--     Those Community threads are removed. They were outside the new rule.
--
-- Mitch: after this succeeds, hard-refresh the app. Friends at a studio
-- lists people by display name or “Parent of …”, never by email.

alter table public.child_friendships
  add column if not exists studio_id uuid;

alter table public.child_friendships
  drop constraint if exists child_friendships_studio_id_fkey;

alter table public.child_friendships
  add constraint child_friendships_studio_id_fkey
  foreign key (studio_id) references public.studios (id) on delete set null;

create index if not exists child_friendships_studio_id_idx
  on public.child_friendships (studio_id)
  where studio_id is not null;

create table if not exists public.parent_friendships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_low_id uuid not null references auth.users (id) on delete cascade,
  user_high_id uuid not null references auth.users (id) on delete cascade,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  addressee_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_friendships_ordered check (user_low_id < user_high_id),
  constraint parent_friendships_distinct check (user_low_id <> user_high_id),
  constraint parent_friendships_pair unique (studio_id, user_low_id, user_high_id)
);

create index if not exists parent_friendships_requester_idx
  on public.parent_friendships (requester_user_id);
create index if not exists parent_friendships_addressee_idx
  on public.parent_friendships (addressee_user_id);
create index if not exists parent_friendships_studio_idx
  on public.parent_friendships (studio_id);

drop trigger if exists parent_friendships_set_updated_at
  on public.parent_friendships;
create trigger parent_friendships_set_updated_at
  before update on public.parent_friendships
  for each row execute procedure public.set_updated_at();

-- The dancer login attached to a child, when there is one.
create or replace function public.dancer_account_for_child(p_child_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.linked_user_id is not null and exists (
      select 1 from public.profiles p
      where p.id = c.linked_user_id and p.role = 'dancer'
    ) then c.linked_user_id
    when exists (
      select 1 from public.profiles p
      where p.id = c.user_id and p.role = 'dancer'
    ) then c.user_id
    else null
  end
  from public.children c
  where c.id = p_child_id;
$$;

create or replace function public.studio_is_approved(p_studio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.studios s
    where s.id = p_studio and s.status = 'approved'
  );
$$;

create or replace function public.parent_has_dancer_at_studio(
  p_user uuid,
  p_studio uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and public.studio_is_approved(p_studio)
    and coalesce(
      (select p.role from public.profiles p where p.id = p_user),
      'parent'
    ) = 'parent'
    and exists (
      select 1 from public.children c
      where c.user_id = p_user and c.studio_id = p_studio
    );
$$;

create or replace function public.parent_friendship_row_ok(
  p_studio uuid,
  p_low uuid,
  p_high uuid,
  p_requester uuid,
  p_addressee uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_low is not null
    and p_high is not null
    and p_low < p_high
    and p_requester is not null
    and p_addressee is not null
    and p_requester <> p_addressee
    and p_requester in (p_low, p_high)
    and p_addressee in (p_low, p_high)
    and public.parent_has_dancer_at_studio(p_low, p_studio)
    and public.parent_has_dancer_at_studio(p_high, p_studio);
$$;

create or replace function public.dancer_friendship_row_ok(
  p_studio uuid,
  p_low text,
  p_high text,
  p_req_child text,
  p_req_user uuid,
  p_add_child text,
  p_add_user uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_low is not null
    and p_high is not null
    and p_low < p_high
    and p_req_child is not null
    and p_add_child is not null
    and p_req_child <> p_add_child
    and p_req_child in (p_low, p_high)
    and p_add_child in (p_low, p_high)
    and public.studio_is_approved(p_studio)
    and exists (
      select 1 from public.children c
      where c.id = p_req_child and c.studio_id = p_studio
    )
    and exists (
      select 1 from public.children c
      where c.id = p_add_child and c.studio_id = p_studio
    )
    and public.dancer_account_for_child(p_req_child) = p_req_user
    and public.dancer_account_for_child(p_add_child) = p_add_user
    and p_req_user <> p_add_user
    and exists (
      select 1 from public.profiles p
      where p.id = p_req_user and p.role = 'dancer'
    )
    and exists (
      select 1 from public.profiles p
      where p.id = p_add_user and p.role = 'dancer'
    );
$$;

create or replace function public.enforce_parent_friendship_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'declined'
     and new.studio_id = old.studio_id
     and new.user_low_id = old.user_low_id
     and new.user_high_id = old.user_high_id
     and new.requester_user_id = old.requester_user_id
     and new.addressee_user_id = old.addressee_user_id
  then
    return new;
  end if;

  if not public.parent_friendship_row_ok(
    new.studio_id,
    new.user_low_id,
    new.user_high_id,
    new.requester_user_id,
    new.addressee_user_id
  ) then
    raise exception 'Parents can only be friends with other parents at the same approved studio';
  end if;
  return new;
end;
$$;

drop trigger if exists parent_friendships_enforce_rules
  on public.parent_friendships;
create trigger parent_friendships_enforce_rules
  before insert or update on public.parent_friendships
  for each row execute procedure public.enforce_parent_friendship_rules();

create or replace function public.enforce_child_friendship_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.studio_id is null then
    new.status := 'declined';
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'declined'
     and new.studio_id is not distinct from old.studio_id
     and new.child_low_id = old.child_low_id
     and new.child_high_id = old.child_high_id
     and new.requester_child_id = old.requester_child_id
     and new.addressee_child_id = old.addressee_child_id
     and new.requester_user_id = old.requester_user_id
     and new.addressee_user_id = old.addressee_user_id
  then
    return new;
  end if;

  if not public.dancer_friendship_row_ok(
    new.studio_id,
    new.child_low_id,
    new.child_high_id,
    new.requester_child_id,
    new.requester_user_id,
    new.addressee_child_id,
    new.addressee_user_id
  ) then
    raise exception 'Dancers can only be friends with other dancers at the same approved studio';
  end if;
  return new;
end;
$$;

drop trigger if exists child_friendships_enforce_rules
  on public.child_friendships;
create trigger child_friendships_enforce_rules
  before insert or update on public.child_friendships
  for each row execute procedure public.enforce_child_friendship_rules();

alter table public.parent_friendships enable row level security;

drop policy if exists "parent_friendships_select_participant"
  on public.parent_friendships;
create policy "parent_friendships_select_participant"
  on public.parent_friendships
  for select to authenticated
  using (
    auth.uid() = requester_user_id or auth.uid() = addressee_user_id
  );

drop policy if exists "parent_friendships_insert_same_studio_role"
  on public.parent_friendships;
create policy "parent_friendships_insert_same_studio_role"
  on public.parent_friendships
  for insert to authenticated
  with check (
    auth.uid() = requester_user_id
    and public.parent_friendship_row_ok(
      studio_id,
      user_low_id,
      user_high_id,
      requester_user_id,
      addressee_user_id
    )
  );

drop policy if exists "child_friendships_insert_same_studio_role"
  on public.child_friendships;
create policy "child_friendships_insert_same_studio_role"
  on public.child_friendships
  for insert to authenticated
  with check (
    auth.uid() = requester_user_id
    and public.dancer_friendship_row_ok(
      studio_id,
      child_low_id,
      child_high_id,
      requester_child_id,
      requester_user_id,
      addressee_child_id,
      addressee_user_id
    )
  );

revoke insert, update, delete on public.parent_friendships from authenticated;
grant select on public.parent_friendships to authenticated;

-- Direct inserts stay revoked on child_friendships (see 20260921_kids_friends).
-- The insert policy above applies if that grant is ever added.

-- Move existing rows onto the new rules. Do this before Community's delete
-- trigger learns about DELETE, and drop the child_friendships foreign key
-- first so kept message threads are not cascaded away.
do $$
declare
  r record;
begin
  if to_regclass('public.community_messages') is not null then
    for r in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'community_messages'
        and c.contype = 'f'
        and pg_get_constraintdef(c.oid) ilike '%child_friendships%'
    loop
      execute format(
        'alter table public.community_messages drop constraint %I',
        r.conname
      );
    end loop;
  end if;

  create temp table friend_class on commit drop as
  select
    f.id,
    f.status,
    f.created_at,
    c1.studio_id,
    c1.user_id as owner_req,
    c2.user_id as owner_add,
    public.dancer_account_for_child(c1.id) as dancer_req,
    public.dancer_account_for_child(c2.id) as dancer_add,
    case
      when c1.studio_id is null
        or c2.studio_id is null
        or c1.studio_id <> c2.studio_id
        or not public.studio_is_approved(c1.studio_id)
      then 'invalid'
      when public.dancer_account_for_child(c1.id) is not null
       and public.dancer_account_for_child(c2.id) is not null
       and (
         (
           f.requester_user_id = public.dancer_account_for_child(c1.id)
           and f.addressee_user_id = public.dancer_account_for_child(c2.id)
         )
         or (
           coalesce(pr.role, '') = 'dancer'
           and coalesce(pa.role, '') = 'dancer'
         )
       )
      then 'dancer'
      when coalesce(pr.role, 'parent') = 'parent'
       and coalesce(pa.role, 'parent') = 'parent'
       and c1.user_id <> c2.user_id
      then 'parent'
      else 'invalid'
    end as kind
  from public.child_friendships f
  join public.children c1 on c1.id = f.requester_child_id
  join public.children c2 on c2.id = f.addressee_child_id
  left join public.profiles pr on pr.id = c1.user_id
  left join public.profiles pa on pa.id = c2.user_id;

  update public.child_friendships f
  set status = 'declined'
  from friend_class m
  where f.id = m.id
    and m.kind = 'invalid'
    and f.status <> 'declined';

  update public.child_friendships f
  set studio_id = m.studio_id,
      requester_user_id = m.dancer_req,
      addressee_user_id = m.dancer_add
  from friend_class m
  where f.id = m.id
    and m.kind = 'dancer'
    and m.dancer_req is not null
    and m.dancer_add is not null;

  create temp table friend_keep on commit drop as
  select distinct on (
    m.studio_id,
    least(m.owner_req, m.owner_add),
    greatest(m.owner_req, m.owner_add)
  )
    m.id,
    m.studio_id,
    least(m.owner_req, m.owner_add) as user_low,
    greatest(m.owner_req, m.owner_add) as user_high,
    m.owner_req as requester_user_id,
    m.owner_add as addressee_user_id,
    m.status,
    m.created_at
  from friend_class m
  where m.kind = 'parent'
  order by
    m.studio_id,
    least(m.owner_req, m.owner_add),
    greatest(m.owner_req, m.owner_add),
    case m.status when 'accepted' then 0 when 'pending' then 1 else 2 end,
    m.created_at;

  insert into public.parent_friendships (
    id,
    studio_id,
    user_low_id,
    user_high_id,
    requester_user_id,
    addressee_user_id,
    status,
    created_at
  )
  select
    k.id,
    k.studio_id,
    k.user_low,
    k.user_high,
    k.requester_user_id,
    k.addressee_user_id,
    k.status,
    k.created_at
  from friend_keep k
  where public.parent_friendship_row_ok(
    k.studio_id,
    k.user_low,
    k.user_high,
    k.requester_user_id,
    k.addressee_user_id
  )
  and not exists (
    select 1 from public.parent_friendships p
    where p.studio_id = k.studio_id
      and p.user_low_id = k.user_low
      and p.user_high_id = k.user_high
  );

  update public.child_friendships f
  set status = 'declined'
  from friend_class m
  where f.id = m.id
    and m.kind = 'parent'
    and not exists (
      select 1 from public.parent_friendships p
      where p.studio_id = m.studio_id
        and p.user_low_id = least(m.owner_req, m.owner_add)
        and p.user_high_id = greatest(m.owner_req, m.owner_add)
    )
    and f.status <> 'declined';

  if to_regclass('public.community_messages') is not null then
    update public.community_messages msg
    set friendship_id = k.id
    from friend_class m
    join friend_keep k
      on k.studio_id = m.studio_id
     and k.user_low = least(m.owner_req, m.owner_add)
     and k.user_high = greatest(m.owner_req, m.owner_add)
    where m.kind = 'parent'
      and m.id <> k.id
      and msg.friendship_id = m.id
      and exists (
        select 1 from public.parent_friendships p where p.id = k.id
      );
  end if;

  delete from public.child_friendships f
  using friend_class m
  where f.id = m.id
    and m.kind = 'parent'
    and exists (
      select 1 from public.parent_friendships p
      where p.studio_id = m.studio_id
        and p.user_low_id = least(m.owner_req, m.owner_add)
        and p.user_high_id = greatest(m.owner_req, m.owner_add)
    );
end;
$$;

create or replace function public.purge_community_messages_if_unfriended()
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

drop trigger if exists child_friendships_purge_community
  on public.child_friendships;
create trigger child_friendships_purge_community
  after update of status, studio_id or delete on public.child_friendships
  for each row execute procedure public.purge_community_messages_if_unfriended();

drop trigger if exists parent_friendships_purge_community
  on public.parent_friendships;
create trigger parent_friendships_purge_community
  after update of status or delete on public.parent_friendships
  for each row execute procedure public.purge_community_messages_if_unfriended();

create or replace function public.is_community_thread_member(p_friendship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_friendships f
    where f.id = p_friendship_id
      and f.status = 'accepted'
      and (
        f.requester_user_id = auth.uid()
        or f.addressee_user_id = auth.uid()
      )
      and public.parent_friendship_row_ok(
        f.studio_id,
        f.user_low_id,
        f.user_high_id,
        f.requester_user_id,
        f.addressee_user_id
      )
  )
  or exists (
    select 1
    from public.child_friendships f
    where f.id = p_friendship_id
      and f.status = 'accepted'
      and (
        f.requester_user_id = auth.uid()
        or f.addressee_user_id = auth.uid()
      )
      and public.dancer_friendship_row_ok(
        f.studio_id,
        f.child_low_id,
        f.child_high_id,
        f.requester_child_id,
        f.requester_user_id,
        f.addressee_child_id,
        f.addressee_user_id
      )
  );
$$;

create or replace function public.studio_friend_label(
  p_user uuid,
  p_studio uuid,
  p_role text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_display text;
  v_name text;
  v_names text[];
  v_count int;
begin
  select nullif(btrim(p.display_name), '')
  into v_display
  from public.profiles p
  where p.id = p_user;

  if v_display is not null and position('@' in v_display) > 0 then
    v_display := null;
  end if;

  if p_role = 'dancer' then
    select nullif(btrim(c.name), '')
    into v_name
    from public.children c
    where c.studio_id = p_studio
      and public.dancer_account_for_child(c.id) = p_user
      and position('@' in c.name) = 0
    order by c.created_at
    limit 1;

    if v_name is not null then
      return left(v_name, 80);
    end if;
    if v_display is not null then
      return left(v_display, 80);
    end if;
    return 'Dancer';
  end if;

  if v_display is not null then
    return left(v_display, 80);
  end if;

  select coalesce(array_agg(n order by n), '{}'::text[])
  into v_names
  from (
    select distinct left(btrim(c.name), 80) as n
    from public.children c
    where c.user_id = p_user
      and c.studio_id = p_studio
      and nullif(btrim(c.name), '') is not null
      and position('@' in c.name) = 0
  ) names;

  v_count := coalesce(cardinality(v_names), 0);
  if v_count = 1 then
    return 'Parent of ' || v_names[1];
  elsif v_count = 2 then
    return 'Parent of ' || v_names[1] || ' and ' || v_names[2];
  elsif v_count > 2 then
    return left(
      'Parent of '
        || array_to_string(v_names[1:v_count - 1], ', ')
        || ' and '
        || v_names[v_count],
      160
    );
  end if;
  return 'Parent';
end;
$$;

create or replace function public.parent_friend_dancers(
  p_user uuid,
  p_studio uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'child_id', c.id,
        'name', case
          when position('@' in c.name) > 0 then 'Dancer'
          else left(btrim(c.name), 80)
        end,
        'enrolled_comp_ids', to_jsonb(
          coalesce(public.friend_enrolled_comp_ids(c.id), '{}'::text[])
        )
      )
      order by c.name
    ),
    '[]'::jsonb
  )
  from public.children c
  where c.user_id = p_user
    and c.studio_id = p_studio
    and nullif(btrim(c.name), '') is not null;
$$;

create or replace function public.studio_friend_people(
  p_studio uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_my_child text;
  v_people jsonb;
begin
  if v_user is null or not public.studio_is_approved(p_studio) then
    return '[]'::jsonb;
  end if;

  if p_role = 'dancer' then
    if not exists (
      select 1 from public.profiles p
      where p.id = v_user and p.role = 'dancer'
    ) then
      return '[]'::jsonb;
    end if;

    select c.id
    into v_my_child
    from public.children c
    where c.studio_id = p_studio
      and public.dancer_account_for_child(c.id) = v_user
    order by c.created_at
    limit 1;

    if v_my_child is null then
      return '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(person order by person->>'label'), '[]'::jsonb)
    into v_people
    from (
      select jsonb_build_object(
        'user_id', others.user_id,
        'label', public.studio_friend_label(others.user_id, p_studio, 'dancer'),
        'status', case
          when f.studio_id = p_studio and f.status = 'accepted' then 'accepted'
          when f.studio_id = p_studio and f.status = 'pending' and f.addressee_user_id = v_user then 'pending_in'
          when f.studio_id = p_studio and f.status = 'pending' and f.requester_user_id = v_user then 'pending_out'
          else 'none'
        end,
        'friendship_id', case
          when f.studio_id = p_studio and f.status in ('pending', 'accepted') then f.id
          else null
        end,
        'child_id', others.child_id,
        'enrolled_comp_ids', case
          when f.studio_id = p_studio and f.status = 'accepted' then to_jsonb(
            coalesce(public.friend_enrolled_comp_ids(others.child_id), '{}'::text[])
          )
          else '[]'::jsonb
        end,
        'dancers', case
          when f.studio_id = p_studio and f.status = 'accepted' then jsonb_build_array(
            jsonb_build_object(
              'child_id', others.child_id,
              'name', public.studio_friend_label(others.user_id, p_studio, 'dancer'),
              'enrolled_comp_ids', to_jsonb(
                coalesce(public.friend_enrolled_comp_ids(others.child_id), '{}'::text[])
              )
            )
          )
          else '[]'::jsonb
        end
      ) as person
      from (
        select distinct on (public.dancer_account_for_child(c.id))
          public.dancer_account_for_child(c.id) as user_id,
          c.id as child_id
        from public.children c
        where c.studio_id = p_studio
          and public.dancer_account_for_child(c.id) is not null
          and public.dancer_account_for_child(c.id) <> v_user
        order by public.dancer_account_for_child(c.id), c.created_at
      ) others
      left join public.child_friendships f
        on f.child_low_id = least(v_my_child, others.child_id)
       and f.child_high_id = greatest(v_my_child, others.child_id)
    ) listed;

    return coalesce(v_people, '[]'::jsonb);
  end if;

  if p_role <> 'parent' or not public.parent_has_dancer_at_studio(v_user, p_studio) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(person order by person->>'label'), '[]'::jsonb)
  into v_people
  from (
    select jsonb_build_object(
      'user_id', p.id,
      'label', public.studio_friend_label(p.id, p_studio, 'parent'),
      'status', case
        when f.status = 'accepted' then 'accepted'
        when f.status = 'pending' and f.addressee_user_id = v_user then 'pending_in'
        when f.status = 'pending' and f.requester_user_id = v_user then 'pending_out'
        else 'none'
      end,
      'friendship_id', case
        when f.status in ('pending', 'accepted') then f.id
        else null
      end,
      'child_id', null,
      'enrolled_comp_ids', case
        when f.status = 'accepted' then coalesce(
          (
            select jsonb_agg(distinct comp_id)
            from public.children c
            cross join lateral unnest(
              coalesce(public.friend_enrolled_comp_ids(c.id), '{}'::text[])
            ) as comp_id
            where c.user_id = p.id and c.studio_id = p_studio
          ),
          '[]'::jsonb
        )
        else '[]'::jsonb
      end,
      'dancers', case
        when f.status = 'accepted' then public.parent_friend_dancers(p.id, p_studio)
        else '[]'::jsonb
      end
    ) as person
    from public.profiles p
    left join public.parent_friendships f
      on f.studio_id = p_studio
     and f.user_low_id = least(v_user, p.id)
     and f.user_high_id = greatest(v_user, p.id)
    where p.id <> v_user
      and public.parent_has_dancer_at_studio(p.id, p_studio)
  ) listed;

  return coalesce(v_people, '[]'::jsonb);
end;
$$;

create or replace function public.list_studio_friends()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_studios jsonb := '[]'::jsonb;
  v_studio record;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.role, 'parent')
  into v_role
  from public.profiles p
  where p.id = v_user;

  if not found then
    v_role := 'parent';
  end if;

  if v_role = 'studio' then
    return jsonb_build_object('role', 'studio', 'studios', '[]'::jsonb);
  end if;

  if v_role = 'dancer' then
    for v_studio in
      select distinct s.id, s.name
      from public.studios s
      join public.children c on c.studio_id = s.id
      where s.status = 'approved'
        and public.dancer_account_for_child(c.id) = v_user
      order by s.name
    loop
      v_studios := v_studios || jsonb_build_array(
        jsonb_build_object(
          'studio_id', v_studio.id,
          'studio_name', coalesce(nullif(btrim(v_studio.name), ''), 'Your studio'),
          'people', public.studio_friend_people(v_studio.id, 'dancer')
        )
      );
    end loop;
  elsif v_role = 'parent' then
    for v_studio in
      select distinct s.id, s.name
      from public.studios s
      join public.children c on c.studio_id = s.id
      where s.status = 'approved'
        and c.user_id = v_user
      order by s.name
    loop
      v_studios := v_studios || jsonb_build_array(
        jsonb_build_object(
          'studio_id', v_studio.id,
          'studio_name', coalesce(nullif(btrim(v_studio.name), ''), 'Your studio'),
          'people', public.studio_friend_people(v_studio.id, 'parent')
        )
      );
    end loop;
  else
    return jsonb_build_object('role', v_role, 'studios', '[]'::jsonb);
  end if;

  return jsonb_build_object('role', v_role, 'studios', v_studios);
end;
$$;

create or replace function public.send_studio_friend_request(
  p_studio_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_target_role text;
  v_low uuid;
  v_high uuid;
  v_existing public.parent_friendships%rowtype;
  v_child public.child_friendships%rowtype;
  v_from_child text;
  v_to_child text;
  v_child_low text;
  v_child_high text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null or p_target_user_id = v_user then
    raise exception 'That is your own account';
  end if;

  if not public.studio_is_approved(p_studio_id) then
    raise exception 'Link a dancer to an approved studio first';
  end if;

  select coalesce(p.role, 'parent') into v_role
  from public.profiles p where p.id = v_user;
  if not found then
    v_role := 'parent';
  end if;

  select coalesce(p.role, 'parent') into v_target_role
  from public.profiles p where p.id = p_target_user_id;
  if not found then
    raise exception 'That person is not at your studio';
  end if;

  if v_role = 'studio' then
    raise exception 'Studio accounts do not add friends here';
  end if;

  if v_role is distinct from v_target_role
     or v_role not in ('parent', 'dancer') then
    raise exception 'You can only add friends with the same account type';
  end if;

  if v_role = 'parent' then
    if not public.parent_has_dancer_at_studio(v_user, p_studio_id)
       or not public.parent_has_dancer_at_studio(p_target_user_id, p_studio_id) then
      raise exception 'That person is not at your studio';
    end if;

    v_low := least(v_user, p_target_user_id);
    v_high := greatest(v_user, p_target_user_id);

    select * into v_existing
    from public.parent_friendships
    where studio_id = p_studio_id
      and user_low_id = v_low
      and user_high_id = v_high;

    if found then
      if v_existing.status = 'accepted'
         and public.parent_friendship_row_ok(
           p_studio_id, v_low, v_high, v_existing.requester_user_id, v_existing.addressee_user_id
         ) then
        raise exception 'You are already friends.';
      end if;
      if v_existing.status = 'pending' and v_existing.addressee_user_id = v_user then
        raise exception 'They already sent you a request';
      end if;
      if v_existing.status = 'pending' and v_existing.requester_user_id = v_user then
        raise exception 'Request already waiting';
      end if;

      update public.parent_friendships
      set requester_user_id = v_user,
          addressee_user_id = p_target_user_id,
          status = 'pending'
      where id = v_existing.id
      returning id into v_id;

      return jsonb_build_object('ok', true, 'status', 'pending', 'friendship_id', v_id);
    end if;

    insert into public.parent_friendships (
      studio_id,
      user_low_id,
      user_high_id,
      requester_user_id,
      addressee_user_id,
      status
    )
    values (p_studio_id, v_low, v_high, v_user, p_target_user_id, 'pending')
    returning id into v_id;

    return jsonb_build_object('ok', true, 'status', 'pending', 'friendship_id', v_id);
  end if;

  select c.id
  into v_from_child
  from public.children c
  where c.studio_id = p_studio_id
    and public.dancer_account_for_child(c.id) = v_user
  order by c.created_at
  limit 1;

  select c.id
  into v_to_child
  from public.children c
  where c.studio_id = p_studio_id
    and public.dancer_account_for_child(c.id) = p_target_user_id
  order by c.created_at
  limit 1;

  if v_from_child is null then
    raise exception 'Link a dancer to an approved studio first';
  end if;
  if v_to_child is null or v_from_child = v_to_child then
    raise exception 'That person is not at your studio';
  end if;

  v_child_low := least(v_from_child, v_to_child);
  v_child_high := greatest(v_from_child, v_to_child);

  select * into v_child
  from public.child_friendships
  where child_low_id = v_child_low and child_high_id = v_child_high;

  if found then
    if v_child.status = 'accepted'
       and public.dancer_friendship_row_ok(
         p_studio_id,
         v_child_low,
         v_child_high,
         v_child.requester_child_id,
         v_child.requester_user_id,
         v_child.addressee_child_id,
         v_child.addressee_user_id
       ) then
      raise exception 'You are already friends.';
    end if;
    if v_child.status = 'pending'
       and v_child.studio_id = p_studio_id
       and v_child.addressee_user_id = v_user then
      raise exception 'They already sent you a request';
    end if;
    if v_child.status = 'pending'
       and v_child.studio_id = p_studio_id
       and v_child.requester_user_id = v_user then
      raise exception 'Request already waiting';
    end if;

    update public.child_friendships
    set studio_id = p_studio_id,
        requester_child_id = v_from_child,
        requester_user_id = v_user,
        addressee_child_id = v_to_child,
        addressee_user_id = p_target_user_id,
        status = 'pending'
    where id = v_child.id
    returning id into v_id;

    return jsonb_build_object('ok', true, 'status', 'pending', 'friendship_id', v_id);
  end if;

  insert into public.child_friendships (
    studio_id,
    child_low_id,
    child_high_id,
    requester_child_id,
    requester_user_id,
    addressee_child_id,
    addressee_user_id,
    status
  )
  values (
    p_studio_id,
    v_child_low,
    v_child_high,
    v_from_child,
    v_user,
    v_to_child,
    p_target_user_id,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'status', 'pending', 'friendship_id', v_id);
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
  v_parent public.parent_friendships%rowtype;
  v_child public.child_friendships%rowtype;
  v_status text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_status := case when p_accept then 'accepted' else 'declined' end;

  select * into v_parent
  from public.parent_friendships
  where id = p_friendship_id;

  if found then
    if v_parent.addressee_user_id <> v_user then
      raise exception 'Not your request to answer';
    end if;
    if v_parent.status <> 'pending' then
      raise exception 'That request is no longer waiting';
    end if;
    update public.parent_friendships
    set status = v_status
    where id = p_friendship_id;
    return jsonb_build_object(
      'ok', true,
      'status', v_status,
      'friendship_id', p_friendship_id
    );
  end if;

  select * into v_child
  from public.child_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that request';
  end if;

  if v_child.addressee_user_id <> v_user then
    raise exception 'Not your request to answer';
  end if;
  if v_child.status <> 'pending' then
    raise exception 'That request is no longer waiting';
  end if;

  update public.child_friendships
  set status = v_status
  where id = p_friendship_id;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
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
  v_parent public.parent_friendships%rowtype;
  v_child public.child_friendships%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_parent
  from public.parent_friendships
  where id = p_friendship_id;

  if found then
    if v_parent.requester_user_id <> v_user and v_parent.addressee_user_id <> v_user then
      raise exception 'Not your friend to remove';
    end if;
    delete from public.parent_friendships where id = p_friendship_id;
    return jsonb_build_object(
      'ok', true,
      'status', 'removed',
      'friendship_id', p_friendship_id
    );
  end if;

  select * into v_child
  from public.child_friendships
  where id = p_friendship_id;

  if not found then
    raise exception 'Could not find that friend';
  end if;

  if v_child.requester_user_id <> v_user and v_child.addressee_user_id <> v_user then
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

-- Old open search stays callable so a cached page gets a clear refusal
-- instead of adding someone outside the studio.
create or replace function public.lookup_child_for_friend_request(
  p_email text,
  p_child_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  raise exception 'Friend search stays inside your studio';
end;
$$;

create or replace function public.lookup_child_by_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  raise exception 'Friend invites stay inside your studio';
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  raise exception 'Friend requests stay inside your studio. Open Friends at your studio.';
end;
$$;

create or replace function public.list_friends_for_child(p_child_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.actor_can_act_for_child(p_child_id) then
    raise exception 'Not your dancer';
  end if;
  return jsonb_build_object(
    'invite_code', '',
    'share_enrolled', coalesce(
      (
        select s.share_enrolled
        from public.child_friend_settings s
        where s.child_id = p_child_id
      ),
      true
    ),
    'friends', '[]'::jsonb,
    'incoming', '[]'::jsonb,
    'outgoing', '[]'::jsonb
  );
end;
$$;

revoke all on function public.dancer_account_for_child(text) from public, anon, authenticated;
revoke all on function public.studio_is_approved(uuid) from public, anon, authenticated;
revoke all on function public.parent_has_dancer_at_studio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.parent_friendship_row_ok(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.dancer_friendship_row_ok(uuid, text, text, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.enforce_parent_friendship_rules() from public, anon, authenticated;
revoke all on function public.enforce_child_friendship_rules() from public, anon, authenticated;
revoke all on function public.studio_friend_label(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.parent_friend_dancers(uuid, uuid) from public, anon, authenticated;
revoke all on function public.studio_friend_people(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_community_messages_if_unfriended() from public, anon, authenticated;

revoke all on function public.list_studio_friends() from public, anon;
grant execute on function public.list_studio_friends() to authenticated;

revoke all on function public.send_studio_friend_request(uuid, uuid) from public, anon;
grant execute on function public.send_studio_friend_request(uuid, uuid) to authenticated;

revoke all on function public.is_community_thread_member(uuid) from public, anon;
grant execute on function public.is_community_thread_member(uuid) to authenticated;
