-- My Dance Comps — studio accounts
-- Run AFTER 20260921_family_accounts.sql, 20260921_kids_friends.sql,
-- 20260921_community_chat.sql, and 20260922_dancer_accounts.sql.
-- Safe to re-run.
--
-- If you re-run an older SQL file after this one, run this file again last.
-- Older files replace handle_new_user and the dancer pull/push functions.
--
-- Confirm email stays OFF. This file does not turn it on.
-- Mitch (or any address in admin_allowlist) approves studios before they
-- are public or linkable. Pending studios can still fill in their profile.

create table if not exists public.admin_allowlist (
  email text primary key
);

insert into public.admin_allowlist (email)
values ('mitch@greenefficientliving.com.au')
on conflict (email) do nothing;

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  slug text not null default 'studio',
  about text not null default '',
  styles text[] not null default '{}'::text[],
  address_line text not null default '',
  suburb text not null default '',
  state text not null default 'SA',
  postcode text not null default '',
  phone text not null default '',
  website text not null default '',
  contact_email text not null default '',
  logo_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studios drop constraint if exists studios_status_check;
alter table public.studios
  add constraint studios_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.studios drop constraint if exists studios_state_check;
alter table public.studios
  add constraint studios_state_check
  check (state in ('SA', 'VIC', 'NSW', 'QLD', 'WA', 'TAS', 'NT', 'ACT'));

create unique index if not exists studios_slug_uidx on public.studios (slug);
create index if not exists studios_status_name_idx on public.studios (status, name);

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('parent', 'dancer', 'studio'));

alter table public.children
  add column if not exists studio_id uuid;

alter table public.children drop constraint if exists children_studio_id_fkey;
alter table public.children
  add constraint children_studio_id_fkey
  foreign key (studio_id) references public.studios (id) on delete set null;

create index if not exists children_studio_id_idx
  on public.children (studio_id)
  where studio_id is not null;

grant update (studio_id) on public.children to authenticated;
grant insert (studio_id) on public.children to authenticated;

create or replace function public.slugify_studio_name(input text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        regexp_replace(lower(trim(coalesce(input, ''))), '&', ' and ', 'g'),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'studio'
  );
$$;

create or replace function public.is_app_admin()
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
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin
      )
      or exists (
        select 1
        from public.admin_allowlist a
        where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    );
$$;

create or replace function public.claim_admin_from_allowlist()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_user is null or v_email = '' then
    return false;
  end if;
  if not exists (
    select 1 from public.admin_allowlist a where lower(a.email) = v_email
  ) then
    return false;
  end if;
  update public.profiles
  set is_admin = true
  where id = v_user
    and is_admin = false;
  return true;
end;
$$;

create or replace function public.assign_studio_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  if tg_op = 'UPDATE'
     and old.slug is not null
     and old.slug <> ''
     and old.slug <> 'studio'
     and (
       new.name is not distinct from old.name
       or old.status = 'approved'
     ) then
    new.slug := old.slug;
    return new;
  end if;

  base := public.slugify_studio_name(new.name);
  candidate := base;
  while exists (
    select 1
    from public.studios s
    where s.slug = candidate
      and s.id is distinct from new.id
  ) loop
    n := n + 1;
    candidate := base || '-' || n::text;
    if n > 50 then
      candidate := base || '-' || substr(new.id::text, 1, 8);
      exit;
    end if;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create or replace function public.guard_studio_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not public.is_app_admin() then
    new.status := 'pending';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      new.owner_id := old.owner_id;
    end if;
    if new.status is distinct from old.status
       and auth.uid() is not null
       and not public.is_app_admin() then
      raise exception 'Only an admin can change studio approval';
    end if;
  end if;

  if new.status is null or new.status not in ('pending', 'approved', 'rejected') then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create or replace function public.guard_child_studio_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.studio_id is not null
     and (tg_op = 'INSERT' or new.studio_id is distinct from old.studio_id)
     and not exists (
       select 1
       from public.studios s
       where s.id = new.studio_id
         and s.status = 'approved'
     ) then
    raise exception 'That studio is not available to link';
  end if;
  return new;
end;
$$;

create or replace function public.set_studio_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Only an admin can change studio approval';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown studio status';
  end if;
  update public.studios
  set status = p_status
  where id = p_id;
  if not found then
    raise exception 'Studio not found';
  end if;
end;
$$;

drop trigger if exists studios_assign_slug on public.studios;
create trigger studios_assign_slug
  before insert or update of name, slug, status on public.studios
  for each row execute procedure public.assign_studio_slug();

drop trigger if exists studios_guard_row on public.studios;
create trigger studios_guard_row
  before insert or update on public.studios
  for each row execute procedure public.guard_studio_row();

drop trigger if exists studios_set_updated_at on public.studios;
create trigger studios_set_updated_at
  before update on public.studios
  for each row execute procedure public.set_updated_at();

drop trigger if exists children_guard_studio_link on public.children;
create trigger children_guard_studio_link
  before insert or update of studio_id on public.children
  for each row execute procedure public.guard_child_studio_link();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := case
    when new.raw_user_meta_data ->> 'role' = 'dancer' then 'dancer'
    when new.raw_user_meta_data ->> 'role' = 'studio' then 'studio'
    else 'parent'
  end;
  v_username text := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
  v_display text := coalesce(new.raw_user_meta_data ->> 'display_name', '');
  v_studio_name text := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'studio_name', '')), ''),
    nullif(trim(v_display), ''),
    'Dance studio'
  );
begin
  insert into public.profiles (id, display_name, role, username)
  values (new.id, v_display, v_role, v_username)
  on conflict (id) do nothing;

  if v_role = 'studio' then
    insert into public.studios (owner_id, name, status)
    values (new.id, left(v_studio_name, 80), 'pending')
    on conflict (owner_id) do nothing;
  end if;

  return new;
end;
$$;

-- Keep dancer family linking, and copy an approved studio link onto the
-- parent-owned dancer profile.
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
  v_studio_id uuid;
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

  select * into v_source
  from public.children
  where user_id = p_dancer
  order by created_at
  limit 1;

  v_studio_id := null;
  if v_source.studio_id is not null and exists (
    select 1 from public.studios s
    where s.id = v_source.studio_id and s.status = 'approved'
  ) then
    v_studio_id := v_source.studio_id;
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
    set linked_user_id = p_dancer,
        studio_id = coalesce(studio_id, v_studio_id),
        studio = case
          when coalesce(nullif(trim(studio), ''), '') = ''
            then coalesce(v_source.studio, '')
          else studio
        end
    where id = v_child_id;
  else
    v_name := coalesce(
      nullif(trim(v_source.name), ''),
      nullif(trim((select display_name from public.profiles where id = p_dancer)), ''),
      'Dancer'
    );

    v_child_id := gen_random_uuid()::text;
    insert into public.children (
      id, user_id, name, dob, styles, studio, studio_id, home_state, linked_user_id
    )
    values (
      v_child_id,
      p_owner,
      v_name,
      coalesce(v_source.dob, ''),
      coalesce(v_source.styles, '{}'::text[]),
      coalesce(v_source.studio, ''),
      v_studio_id,
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
      'studio_id', v_child.studio_id,
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
  v_studio_raw text;
  v_studio_id uuid;
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

  v_studio_raw := nullif(trim(coalesce(p_state #>> '{child,studio_id}', '')), '');
  v_studio_id := null;
  if v_studio_raw is not null then
    begin
      v_studio_id := v_studio_raw::uuid;
    exception
      when invalid_text_representation then
        v_studio_id := null;
    end;
    if v_studio_id is null or not exists (
      select 1 from public.studios s
      where s.id = v_studio_id and s.status = 'approved'
    ) then
      raise exception 'That studio is not available to link';
    end if;
  end if;

  update public.children
  set name = left(v_name, 80),
      dob = left(coalesce(p_state #>> '{child,dob}', ''), 32),
      styles = v_styles,
      studio = left(coalesce(p_state #>> '{child,studio}', ''), 120),
      studio_id = v_studio_id,
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

alter table public.studios enable row level security;
alter table public.admin_allowlist enable row level security;

drop policy if exists "studios_select_approved" on public.studios;
drop policy if exists "studios_select_own" on public.studios;
drop policy if exists "studios_select_admin" on public.studios;
drop policy if exists "studios_insert_own" on public.studios;
drop policy if exists "studios_update_own" on public.studios;

create policy "studios_select_approved" on public.studios
  for select to anon, authenticated
  using (status = 'approved');

create policy "studios_select_own" on public.studios
  for select to authenticated
  using (owner_id = auth.uid());

create policy "studios_select_admin" on public.studios
  for select to authenticated
  using (public.is_app_admin());

create policy "studios_insert_own" on public.studios
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "studios_update_own" on public.studios
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.admin_allowlist from public, anon, authenticated;
revoke all on public.studios from public, anon, authenticated;

grant select on public.studios to anon, authenticated;
grant insert (
  owner_id,
  name,
  about,
  styles,
  address_line,
  suburb,
  state,
  postcode,
  phone,
  website,
  contact_email,
  logo_path
) on public.studios to authenticated;
grant update (
  name,
  about,
  styles,
  address_line,
  suburb,
  state,
  postcode,
  phone,
  website,
  contact_email,
  logo_path
) on public.studios to authenticated;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated, anon;

revoke all on function public.claim_admin_from_allowlist() from public, anon;
grant execute on function public.claim_admin_from_allowlist() to authenticated;

revoke all on function public.set_studio_status(uuid, text) from public, anon;
grant execute on function public.set_studio_status(uuid, text) to authenticated;

revoke all on function public.slugify_studio_name(text) from public, anon, authenticated;
revoke all on function public.assign_studio_slug() from public, anon, authenticated;
revoke all on function public.guard_studio_row() from public, anon, authenticated;
revoke all on function public.guard_child_studio_link() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-logos',
  'studio-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "studio_logos_public_read" on storage.objects;
create policy "studio_logos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'studio-logos');

drop policy if exists "studio_logos_owner_insert" on storage.objects;
create policy "studio_logos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] in (
      select s.id::text from public.studios s where s.owner_id = auth.uid()
    )
  );

drop policy if exists "studio_logos_owner_update" on storage.objects;
create policy "studio_logos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] in (
      select s.id::text from public.studios s where s.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] in (
      select s.id::text from public.studios s where s.owner_id = auth.uid()
    )
  );

drop policy if exists "studio_logos_owner_delete" on storage.objects;
create policy "studio_logos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'studio-logos'
    and (storage.foldername(name))[1] in (
      select s.id::text from public.studios s where s.owner_id = auth.uid()
    )
  );

update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) in (select lower(email) from public.admin_allowlist)
  and p.is_admin = false;
