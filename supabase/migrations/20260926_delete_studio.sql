-- My Dance Comps — admin delete studio
-- Run AFTER 20260922_studio_accounts.sql, 20260922_studio_community_chat.sql,
-- and 20260923_studio_friendships.sql.
-- Safe to re-run.
--
-- Allowlisted admins (same check as set_studio_status) can delete a studio.
-- Dancers linked to it are unlinked, studio chat and studio friendships go,
-- the logo object is removed when storage is available, then the studio row
-- is deleted so it no longer appears in Approved studios or link pickers.

create or replace function public.delete_studio(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_logo text;
begin
  if not public.is_app_admin() then
    raise exception 'Only an admin can change studio approval';
  end if;

  if p_id is null or not exists (
    select 1 from public.studios s where s.id = p_id
  ) then
    raise exception 'Studio not found';
  end if;

  select s.logo_path
  into v_logo
  from public.studios s
  where s.id = p_id;

  update public.children
  set studio_id = null
  where studio_id = p_id;

  if to_regclass('public.studio_friendships') is not null then
    if to_regclass('public.community_messages') is not null then
      delete from public.community_messages
      where friendship_id in (
        select f.id
        from public.studio_friendships f
        where f.studio_id = p_id
      );
    end if;
    delete from public.studio_friendships
    where studio_id = p_id;
  end if;

  if to_regclass('public.studio_community_messages') is not null then
    delete from public.studio_community_messages
    where studio_id = p_id;
  end if;

  if to_regclass('storage.objects') is not null then
    begin
      delete from storage.objects
      where bucket_id = 'studio-logos'
        and (
          (v_logo is not null and name = v_logo)
          or name like p_id::text || '/%'
        );
    exception
      when others then
        raise warning 'Could not remove studio logo for %: %', p_id, sqlerrm;
    end;
  end if;

  delete from public.studios
  where id = p_id;

  if not found then
    raise exception 'Studio not found';
  end if;
end;
$$;

revoke all on function public.delete_studio(uuid) from public, anon;
grant execute on function public.delete_studio(uuid) to authenticated;
