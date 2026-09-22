-- My Dance Comps — dancer results access
-- Run AFTER 20260925_coparent_family.sql.
-- Safe to re-run.
--
-- Results rows stay on the parent household (user_id = family owner).
-- A linked dancer login can read and change placings for their own profile.
-- Parents keep the existing household check.

create or replace function public.dancer_owns_child(p_child_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(btrim(p_child_id), '') is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      join public.children c on c.id = p.linked_child_id
      where p.id = auth.uid()
        and p.role = 'dancer'
        and p.linked_child_id = p_child_id
        and c.linked_user_id = p.id
    );
$$;

revoke all on function public.dancer_owns_child(text) from public, anon;
grant execute on function public.dancer_owns_child(text) to authenticated;

drop policy if exists "results_select_own" on public.results;
drop policy if exists "results_insert_own" on public.results;
drop policy if exists "results_update_own" on public.results;
drop policy if exists "results_delete_own" on public.results;

create policy "results_select_own" on public.results
  for select to authenticated
  using (
    public.can_access_household_row(user_id, family_id)
    or public.dancer_owns_child(child_id)
  );

create policy "results_insert_own" on public.results
  for insert to authenticated
  with check (
    public.can_access_household_row(user_id, family_id)
    or public.dancer_owns_child(child_id)
  );

create policy "results_update_own" on public.results
  for update to authenticated
  using (
    public.can_access_household_row(user_id, family_id)
    or public.dancer_owns_child(child_id)
  )
  with check (
    public.can_access_household_row(user_id, family_id)
    or public.dancer_owns_child(child_id)
  );

create policy "results_delete_own" on public.results
  for delete to authenticated
  using (
    public.can_access_household_row(user_id, family_id)
    or public.dancer_owns_child(child_id)
  );
