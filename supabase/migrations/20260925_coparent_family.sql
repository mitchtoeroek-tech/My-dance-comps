-- My Dance Comps — co-parent invites
-- Run AFTER 20260924_sibling_friendships.sql and 20260923_chat_sender_labels.sql.
-- Safe to re-run: objects are created or replaced idempotently.
--
-- This does not replace the dancer family code. Dancers still join with
-- families.invite_code. A second parent uses families.coparent_code, or an
-- email invite, and must sign up or log in as a parent (not a dancer).
--
-- Confirm email stays OFF. Add these redirect URLs if they are missing:
--   http://localhost:3000/family/join
--   https://my-dance-comps.vercel.app/family/join
--   https://*-my-dance-comps.vercel.app/family/join
--
-- Shared household rows (dancers, enrolments, results) stay on the current
-- family owner's user id. Any parent in that family can read and write them.
-- Other families stay hidden. Reminder preferences stay on each parent's own
-- profile. Studio chat still uses profiles.display_name: "Sarah, parent of Evie".
--
-- Leave family:
--   * Another parent remains: this parent leaves. Dancers, enrolments and
--     results stay. If this parent was the owner, ownership moves to the
--     other parent (oldest account).
--   * Last parent, and a dancer still has their own login: leaving is refused.
--     The family stays. Invite another parent, or remove those logins, first.
--   * Last parent, and no dancer login is linked: the family code stops
--     working. Dancer profiles, enrolments and results stay on this account.
--
-- Dancers already saved only on the co-parent's own account stay there.
-- They are hidden while that parent belongs to the shared family, and they
-- show again if that parent leaves.
--
-- If you re-run studio chat, studio friendships, sibling friendships, or
-- chat sender labels after this file, run this file again so co-parents stay
-- on the household, studio chat, and "Name, parent of …" label.

alter table public.families
  add column if not exists coparent_code text;

create unique index if not exists families_coparent_code_uidx
  on public.families (coparent_code)
  where coparent_code is not null;

create table if not exists public.family_parent_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists family_parent_invites_email_idx
  on public.family_parent_invites (lower(email));

create unique index if not exists family_parent_invites_pending_uidx
  on public.family_parent_invites (family_id, lower(email))
  where status = 'pending';

alter table public.family_parent_invites enable row level security;
revoke all on public.family_parent_invites from public, anon, authenticated;

alter table public.children
  add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.results
  add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.enrolled_comps
  add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.enrolled_by_child
  add column if not exists family_id uuid references public.families (id) on delete set null;

alter table public.enrolled_child_sets
  add column if not exists family_id uuid references public.families (id) on delete set null;

create index if not exists children_family_id_idx on public.children (family_id);
create index if not exists results_family_id_idx on public.results (family_id);
create index if not exists enrolled_comps_family_id_idx on public.enrolled_comps (family_id);

-- Owner of the shared dancers/enrolments/results for a parent in a family.
-- Null when this login is not a parent in a family. Not granted to clients.
create or replace function public.household_owner_for(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.owner_user_id
  from public.profiles p
  join public.families f on f.id = p.family_id
  where p.id = p_user
    and p.role = 'parent'
    and p.family_id is not null
  limit 1;
$$;

revoke all on function public.household_owner_for(uuid) from public, anon, authenticated;

create or replace function public.row_in_my_family(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_family is not null
    and p_family = (
      select p.family_id
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
    );
$$;

-- Own rows, including a parent's private rows that are not in the shared
-- family. Shared rows (family_id set) are also visible to every parent in
-- that family. Other families are not.
create or replace function public.can_access_household_row(
  p_owner uuid,
  p_family uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner is not null
    and auth.uid() is not null
    and (
      (
        p_owner = auth.uid()
        and (
          p_family is null
          or public.row_in_my_family(p_family)
          or not exists (
            select 1
            from public.profiles p
            where p.id = auth.uid()
              and p.role = 'parent'
              and p.family_id is not null
          )
        )
      )
      or (
        public.row_in_my_family(p_family)
        and p_owner = public.household_owner_for(auth.uid())
      )
    );
$$;

revoke all on function public.row_in_my_family(uuid) from public, anon, authenticated;
revoke all on function public.can_access_household_row(uuid, uuid) from public, anon;
grant execute on function public.can_access_household_row(uuid, uuid) to authenticated;

create or replace function public.assign_household_family_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  if new.family_id is not null then
    return new;
  end if;
  select p.family_id
  into v_family
  from public.profiles p
  where p.id = new.user_id
    and p.role = 'parent'
    and p.family_id is not null;
  if v_family is not null then
    new.family_id := v_family;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_household_family_id() from public, anon, authenticated;

drop trigger if exists children_assign_family on public.children;
create trigger children_assign_family
  before insert or update on public.children
  for each row execute procedure public.assign_household_family_id();

drop trigger if exists results_assign_family on public.results;
create trigger results_assign_family
  before insert or update on public.results
  for each row execute procedure public.assign_household_family_id();

drop trigger if exists enrolled_comps_assign_family on public.enrolled_comps;
create trigger enrolled_comps_assign_family
  before insert or update on public.enrolled_comps
  for each row execute procedure public.assign_household_family_id();

drop trigger if exists enrolled_by_child_assign_family on public.enrolled_by_child;
create trigger enrolled_by_child_assign_family
  before insert or update on public.enrolled_by_child
  for each row execute procedure public.assign_household_family_id();

drop trigger if exists enrolled_child_sets_assign_family on public.enrolled_child_sets;
create trigger enrolled_child_sets_assign_family
  before insert or update on public.enrolled_child_sets
  for each row execute procedure public.assign_household_family_id();

update public.children c
set family_id = f.id
from public.families f
where c.user_id = f.owner_user_id
  and c.family_id is null;

update public.results r
set family_id = f.id
from public.families f
where r.user_id = f.owner_user_id
  and r.family_id is null;

update public.enrolled_comps e
set family_id = f.id
from public.families f
where e.user_id = f.owner_user_id
  and e.family_id is null;

update public.enrolled_by_child e
set family_id = f.id
from public.families f
where e.user_id = f.owner_user_id
  and e.family_id is null;

update public.enrolled_child_sets e
set family_id = f.id
from public.families f
where e.user_id = f.owner_user_id
  and e.family_id is null;

drop policy if exists "children_select_own" on public.children;
drop policy if exists "children_insert_own" on public.children;
drop policy if exists "children_update_own" on public.children;
drop policy if exists "children_delete_own" on public.children;
create policy "children_select_own" on public.children
  for select to authenticated
  using (public.can_access_household_row(user_id, family_id));
create policy "children_insert_own" on public.children
  for insert to authenticated
  with check (public.can_access_household_row(user_id, family_id));
create policy "children_update_own" on public.children
  for update to authenticated
  using (public.can_access_household_row(user_id, family_id))
  with check (public.can_access_household_row(user_id, family_id));
create policy "children_delete_own" on public.children
  for delete to authenticated
  using (public.can_access_household_row(user_id, family_id));

drop policy if exists "results_select_own" on public.results;
drop policy if exists "results_insert_own" on public.results;
drop policy if exists "results_update_own" on public.results;
drop policy if exists "results_delete_own" on public.results;
create policy "results_select_own" on public.results
  for select to authenticated
  using (public.can_access_household_row(user_id, family_id));
create policy "results_insert_own" on public.results
  for insert to authenticated
  with check (public.can_access_household_row(user_id, family_id));
create policy "results_update_own" on public.results
  for update to authenticated
  using (public.can_access_household_row(user_id, family_id))
  with check (public.can_access_household_row(user_id, family_id));
create policy "results_delete_own" on public.results
  for delete to authenticated
  using (public.can_access_household_row(user_id, family_id));

drop policy if exists "enrolled_select_own" on public.enrolled_comps;
drop policy if exists "enrolled_insert_own" on public.enrolled_comps;
drop policy if exists "enrolled_delete_own" on public.enrolled_comps;
create policy "enrolled_select_own" on public.enrolled_comps
  for select to authenticated
  using (public.can_access_household_row(user_id, family_id));
create policy "enrolled_insert_own" on public.enrolled_comps
  for insert to authenticated
  with check (public.can_access_household_row(user_id, family_id));
create policy "enrolled_delete_own" on public.enrolled_comps
  for delete to authenticated
  using (public.can_access_household_row(user_id, family_id));

drop policy if exists "enrolled_by_child_select_own" on public.enrolled_by_child;
drop policy if exists "enrolled_by_child_insert_own" on public.enrolled_by_child;
drop policy if exists "enrolled_by_child_delete_own" on public.enrolled_by_child;
create policy "enrolled_by_child_select_own" on public.enrolled_by_child
  for select to authenticated
  using (public.can_access_household_row(user_id, family_id));
create policy "enrolled_by_child_insert_own" on public.enrolled_by_child
  for insert to authenticated
  with check (public.can_access_household_row(user_id, family_id));
create policy "enrolled_by_child_delete_own" on public.enrolled_by_child
  for delete to authenticated
  using (public.can_access_household_row(user_id, family_id));

drop policy if exists "enrolled_child_sets_select_own" on public.enrolled_child_sets;
drop policy if exists "enrolled_child_sets_insert_own" on public.enrolled_child_sets;
drop policy if exists "enrolled_child_sets_delete_own" on public.enrolled_child_sets;
create policy "enrolled_child_sets_select_own" on public.enrolled_child_sets
  for select to authenticated
  using (public.can_access_household_row(user_id, family_id));
create policy "enrolled_child_sets_insert_own" on public.enrolled_child_sets
  for insert to authenticated
  with check (public.can_access_household_row(user_id, family_id));
create policy "enrolled_child_sets_delete_own" on public.enrolled_child_sets
  for delete to authenticated
  using (public.can_access_household_row(user_id, family_id));

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
        or (
          public.household_owner_for(auth.uid()) is not null
          and c.user_id = public.household_owner_for(auth.uid())
        )
      )
  );
$$;

revoke all on function public.actor_can_act_for_child(text) from public, anon, authenticated;

-- A co-parent counts as a parent at each studio their family dancers use.
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
          where c.studio_id = p_studio_id
            and (
              c.user_id = p_user
              or (
                public.household_owner_for(p_user) is not null
                and c.user_id = public.household_owner_for(p_user)
              )
            )
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

revoke all on function public.user_on_studio_role(uuid, uuid, text) from public, anon, authenticated;

-- A co-parent is a parent of the family's linked dancers, so they still
-- cannot be friends with those dancers.
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
          (
            c.user_id = p_a
            or (
              public.household_owner_for(p_a) is not null
              and c.user_id = public.household_owner_for(p_a)
            )
          )
          and (
            c.linked_user_id = p_b
            or c.id = pb.linked_child_id
          )
        )
        or (
          (
            c.user_id = p_b
            or (
              public.household_owner_for(p_b) is not null
              and c.user_id = public.household_owner_for(p_b)
            )
          )
          and (
            c.linked_user_id = p_a
            or c.id = pa.linked_child_id
          )
        )
    );
$$;

revoke all on function public.accounts_are_parent_and_child(uuid, uuid) from public, anon, authenticated;

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
                or (
                  public.household_owner_for(auth.uid()) is not null
                  and c.user_id = public.household_owner_for(auth.uid())
                )
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

revoke all on function public.is_studio_chat_member(uuid) from public, anon;
grant execute on function public.is_studio_chat_member(uuid) to authenticated;

-- Same wording as 20260923_chat_sender_labels.sql, plus household dancers
-- so a co-parent shows as "Sarah, parent of Evie".
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
  v_owner uuid;
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

  v_owner := public.household_owner_for(p_user);

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
      and (
        c.user_id = p_user
        or (v_owner is not null and c.user_id = v_owner)
      )
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

create or replace function public.household_scope()
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
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select role, family_id
  into v_role, v_family
  from public.profiles
  where id = v_user;

  if coalesce(v_role, 'parent') is distinct from 'parent' or v_family is null then
    return jsonb_build_object('owner_id', v_user, 'family_id', null);
  end if;

  select owner_user_id
  into v_owner
  from public.families
  where id = v_family;

  return jsonb_build_object(
    'owner_id', coalesce(v_owner, v_user),
    'family_id', v_family
  );
end;
$$;

create or replace function public.ensure_coparent_invite()
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

  select role into v_role from public.profiles where id = v_user;
  if coalesce(v_role, 'parent') is distinct from 'parent' then
    raise exception 'Parents create the family code';
  end if;

  perform public.ensure_family();

  select family_id into v_family from public.profiles where id = v_user;
  if v_family is null then
    raise exception 'Parents create the family code';
  end if;

  select coparent_code into v_code from public.families where id = v_family;
  if coalesce(v_code, '') = '' then
    loop
      begin
        v_code := public.generate_friend_invite_code();
        update public.families
        set coparent_code = v_code
        where id = v_family;
        exit;
      exception
        when unique_violation then
          null;
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'family_id', v_family,
    'coparent_code', v_code
  );
end;
$$;

create or replace function public.list_family_parents()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_owner uuid;
  v_parents jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select family_id into v_family
  from public.profiles
  where id = v_user
    and role = 'parent';

  if v_family is null then
    return '[]'::jsonb;
  end if;

  select owner_user_id into v_owner from public.families where id = v_family;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_name', case
          when nullif(btrim(p.display_name), '') is null
            or position('@' in p.display_name) > 0
            then 'Parent'
          else left(btrim(p.display_name), 80)
        end,
        'is_owner', p.id = v_owner,
        'is_you', p.id = v_user
      )
      order by (p.id = v_owner) desc, btrim(p.display_name), p.created_at
    ),
    '[]'::jsonb
  )
  into v_parents
  from public.profiles p
  where p.family_id = v_family
    and p.role = 'parent';

  return v_parents;
end;
$$;

create or replace function public.invite_coparent_by_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_self text;
  v_existing uuid;
  v_existing_role text;
  v_existing_family uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter the parent''s email address';
  end if;

  if v_email like '%@dancers.mydancecomps.app' then
    raise exception 'That email is a dancer account';
  end if;

  select lower(coalesce(email, '')) into v_self
  from auth.users
  where id = v_user;
  if v_email = v_self then
    raise exception 'That is your own email';
  end if;

  perform public.ensure_coparent_invite();
  select family_id into v_family from public.profiles where id = v_user;

  select u.id, p.role, p.family_id
  into v_existing, v_existing_role, v_existing_family
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.email, '')) = v_email
  limit 1;

  if v_existing is not null then
    if v_existing_role = 'dancer' then
      raise exception 'That email is a dancer account';
    end if;
    if v_existing_role = 'studio' then
      raise exception 'That email is a studio account';
    end if;
    if v_existing_family = v_family then
      raise exception 'That parent is already in this family';
    end if;
    if v_existing_family is not null then
      raise exception 'That parent is already in another family';
    end if;
  end if;

  insert into public.family_parent_invites (family_id, email, invited_by, status)
  values (v_family, v_email, v_user, 'pending')
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

create or replace function public.preview_coparent_invite(p_code text)
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
  v_parents jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_code = '' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_family
  from public.families
  where coparent_code = v_code;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(nullif(btrim(display_name), ''), 'A parent')
  into v_label
  from public.profiles
  where id = v_family.owner_user_id;

  if position('@' in v_label) > 0 then
    v_label := 'A parent';
  end if;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into v_parents
  from (
    select case
      when nullif(btrim(p.display_name), '') is null
        or position('@' in p.display_name) > 0
        then 'Parent'
      else left(btrim(p.display_name), 80)
    end as name
    from public.profiles p
    where p.family_id = v_family.id
      and p.role = 'parent'
  ) named;

  return jsonb_build_object(
    'ok', true,
    'family_name', v_label,
    'parents', v_parents
  );
end;
$$;

create or replace function public.list_my_coparent_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_rows jsonb;
begin
  if v_user is null then
    return '[]'::jsonb;
  end if;

  if (select role from public.profiles where id = v_user) is distinct from 'parent' then
    return '[]'::jsonb;
  end if;

  select lower(coalesce(email, '')) into v_email
  from auth.users
  where id = v_user;

  if v_email = '' then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'family_name', case
          when nullif(btrim(owner.display_name), '') is null
            or position('@' in owner.display_name) > 0
            then 'A parent'
          else left(btrim(owner.display_name), 80)
        end,
        'inviter_name', case
          when nullif(btrim(inviter.display_name), '') is null
            or position('@' in inviter.display_name) > 0
            then 'A parent'
          else left(btrim(inviter.display_name), 80)
        end,
        'code', f.coparent_code
      )
      order by i.created_at
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.family_parent_invites i
  join public.families f on f.id = i.family_id
  left join public.profiles owner on owner.id = f.owner_user_id
  left join public.profiles inviter on inviter.id = i.invited_by
  where i.status = 'pending'
    and lower(i.email) = v_email
    and coalesce(f.coparent_code, '') <> '';

  return v_rows;
end;
$$;

create or replace function public.accept_coparent_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_family uuid;
  v_code text := public.normalize_friend_invite_code(p_code);
  v_target public.families%rowtype;
  v_email text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select role, family_id into v_role, v_family
  from public.profiles
  where id = v_user;

  if coalesce(v_role, 'parent') is distinct from 'parent' then
    raise exception 'Co-parent invites are for parent accounts';
  end if;

  if v_code = '' then
    raise exception 'That co-parent invite was not recognised';
  end if;

  select * into v_target
  from public.families
  where coparent_code = v_code;

  if not found then
    raise exception 'That co-parent invite was not recognised';
  end if;

  if v_family = v_target.id then
    return jsonb_build_object('ok', true, 'status', 'already', 'family_id', v_family);
  end if;

  if v_family is not null then
    raise exception 'Leave your current family before joining another';
  end if;

  update public.profiles
  set family_id = v_target.id
  where id = v_user;

  select lower(coalesce(email, '')) into v_email
  from auth.users
  where id = v_user;

  if v_email <> '' then
    update public.family_parent_invites
    set status = case
      when family_id = v_target.id then 'accepted'
      else 'cancelled'
    end
    where status = 'pending'
      and lower(email) = v_email;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'joined',
    'family_id', v_target.id
  );
end;
$$;

create or replace function public.transfer_household_owner(
  p_family uuid,
  p_from uuid,
  p_to uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_family is null or p_from is null or p_to is null or p_from = p_to then
    return;
  end if;

  update public.families
  set owner_user_id = p_to
  where id = p_family
    and owner_user_id = p_from;

  update public.children
  set user_id = p_to
  where user_id = p_from
    and family_id = p_family;

  update public.results
  set user_id = p_to
  where user_id = p_from
    and family_id = p_family;

  insert into public.enrolled_comps (user_id, comp_id, family_id)
  select p_to, e.comp_id, e.family_id
  from public.enrolled_comps e
  where e.user_id = p_from
    and e.family_id = p_family
  on conflict (user_id, comp_id) do update
  set family_id = excluded.family_id;

  delete from public.enrolled_comps
  where user_id = p_from
    and family_id = p_family;

  update public.enrolled_by_child
  set user_id = p_to
  where user_id = p_from
    and family_id = p_family;

  update public.enrolled_child_sets
  set user_id = p_to
  where user_id = p_from
    and family_id = p_family;

  update public.child_friend_settings
  set user_id = p_to
  where user_id = p_from
    and child_id in (
      select c.id from public.children c where c.family_id = p_family
    );

  update public.child_friendships
  set requester_user_id = p_to
  where requester_user_id = p_from;

  update public.child_friendships
  set addressee_user_id = p_to
  where addressee_user_id = p_from;
end;
$$;

revoke all on function public.transfer_household_owner(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_parent_family()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_family uuid;
  v_owner uuid;
  v_next uuid;
  v_others int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select role, family_id into v_role, v_family
  from public.profiles
  where id = v_user;

  if coalesce(v_role, 'parent') is distinct from 'parent' or v_family is null then
    raise exception 'You are not in a family yet';
  end if;

  select count(*) into v_others
  from public.profiles
  where family_id = v_family
    and role = 'parent'
    and id <> v_user;

  if v_others > 0 then
    select owner_user_id into v_owner from public.families where id = v_family;
    if v_owner = v_user then
      select p.id into v_next
      from public.profiles p
      where p.family_id = v_family
        and p.role = 'parent'
        and p.id <> v_user
      order by p.created_at, p.id
      limit 1;
      perform public.transfer_household_owner(v_family, v_user, v_next);
    end if;

    update public.profiles
    set family_id = null
    where id = v_user;

    return jsonb_build_object('ok', true, 'status', 'left');
  end if;

  if exists (
    select 1
    from public.children c
    where c.family_id = v_family
      and c.linked_user_id is not null
  ) or exists (
    select 1
    from public.profiles p
    where p.family_id = v_family
      and p.role = 'dancer'
  ) then
    raise exception 'A dancer still has their own login in this family';
  end if;

  update public.profiles
  set family_id = null
  where id = v_user;

  update public.children
  set family_id = null
  where user_id = v_user
    and family_id = v_family;

  update public.results
  set family_id = null
  where user_id = v_user
    and family_id = v_family;

  update public.enrolled_comps
  set family_id = null
  where user_id = v_user
    and family_id = v_family;

  update public.enrolled_by_child
  set family_id = null
  where user_id = v_user
    and family_id = v_family;

  update public.enrolled_child_sets
  set family_id = null
  where user_id = v_user
    and family_id = v_family;

  delete from public.families where id = v_family;

  return jsonb_build_object('ok', true, 'status', 'dissolved');
end;
$$;

-- Any parent in the family can invite a dancer. The profile stays on the
-- household owner, which is what dancer join already expects.
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
  v_role text;
  v_family uuid;
  v_owner uuid;
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

  select role into v_role from public.profiles where id = v_user;
  if coalesce(v_role, 'parent') is distinct from 'parent' then
    raise exception 'Parents create the family code';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter the dancer''s email address';
  end if;

  if v_email like '%@dancers.mydancecomps.app' then
    raise exception 'Username logins join with the family code';
  end if;

  v_owner := public.household_owner_for(v_user);
  if v_owner is null then
    v_family := (public.ensure_family() ->> 'family_id')::uuid;
    v_owner := v_user;
  else
    select family_id into v_family from public.profiles where id = v_user;
  end if;

  if v_child is not null then
    if not exists (
      select 1 from public.children c
      where c.id = v_child
        and c.user_id = v_owner
        and c.linked_user_id is null
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
    v_linked := public.link_dancer_account(v_existing, v_owner, v_family, v_child);
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

  if (select role from public.profiles where id = v_user) is distinct from 'parent' then
    raise exception 'Parents remove a dancer login';
  end if;

  if not exists (
    select 1
    from public.children
    where id = p_child_id
      and linked_user_id is not null
      and public.actor_can_act_for_child(p_child_id)
  ) then
    raise exception 'That dancer does not have their own login';
  end if;

  perform public.detach_linked_dancer(p_child_id);
  return jsonb_build_object('ok', true, 'status', 'unlinked');
end;
$$;

revoke all on function public.household_scope() from public, anon;
grant execute on function public.household_scope() to authenticated;

revoke all on function public.ensure_coparent_invite() from public, anon;
grant execute on function public.ensure_coparent_invite() to authenticated;

revoke all on function public.list_family_parents() from public, anon;
grant execute on function public.list_family_parents() to authenticated;

revoke all on function public.invite_coparent_by_email(text) from public, anon;
grant execute on function public.invite_coparent_by_email(text) to authenticated;

revoke all on function public.preview_coparent_invite(text) from public, anon;
grant execute on function public.preview_coparent_invite(text) to authenticated;

revoke all on function public.list_my_coparent_invites() from public, anon;
grant execute on function public.list_my_coparent_invites() to authenticated;

revoke all on function public.accept_coparent_invite(text) from public, anon;
grant execute on function public.accept_coparent_invite(text) to authenticated;

revoke all on function public.leave_parent_family() from public, anon;
grant execute on function public.leave_parent_family() to authenticated;

do $$
begin
  if to_regclass('public.studio_community_messages') is null then
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
