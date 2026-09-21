import { getSupabase } from "./supabase";
import { enrolledIdsForChild } from "./enrolled";
import {
  defaultFamilyState,
  defaultReminderPrefs,
  normalizeFamilyState,
} from "./storage";
import { isAuStateCode } from "./types";
import type {
  ChildProfile,
  CompResult,
  FamilyState,
  ReminderPrefs,
} from "./types";

type ProfileRow = {
  id: string;
  display_name: string | null;
  selected_child_id: string | null;
  include_interstate: boolean | null;
  preferred_state: string | null;
  reminder_prefs: ReminderPrefs | null;
  notified_reminder_ids: string[] | null;
};

type ChildRow = {
  id: string;
  name: string;
  dob: string | null;
  styles: string[] | null;
  studio: string | null;
  home_state: string | null;
};

type ResultRow = {
  id: string;
  child_id: string;
  comp_id: string | null;
  comp_name: string | null;
  date: string | null;
  section: string | null;
  placing: string | null;
  score: string | null;
  notes: string | null;
};

function uniqueStrings(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeEnrolledByChild(
  local: FamilyState,
  remote: FamilyState,
  childIds: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const allowed = new Set(childIds);
  for (const id of allowed) {
    const localHas = Object.prototype.hasOwnProperty.call(
      local.enrolledByChild,
      id,
    );
    const remoteHas = Object.prototype.hasOwnProperty.call(
      remote.enrolledByChild,
      id,
    );
    if (!localHas && !remoteHas) continue;
    const locIds = localHas
      ? local.enrolledByChild[id] ?? []
      : enrolledIdsForChild(local.enrolled, local.enrolledByChild, id);
    const remIds = remoteHas
      ? remote.enrolledByChild[id] ?? []
      : enrolledIdsForChild(remote.enrolled, remote.enrolledByChild, id);
    out[id] = uniqueStrings(locIds, remIds);
  }
  return out;
}

export function isEmptyFamily(state: FamilyState): boolean {
  return (
    state.children.length === 0 &&
    state.favourites.length === 0 &&
    state.enrolled.length === 0 &&
    Object.keys(state.enrolledByChild ?? {}).length === 0 &&
    state.results.length === 0
  );
}

/** Local device wins on the same id; lists are a union so guest data is kept. */
export function mergeFamilyState(
  local: FamilyState,
  remote: FamilyState,
): FamilyState {
  const loc = normalizeFamilyState(local);
  const rem = normalizeFamilyState(remote);
  const children = mergeById(loc.children, rem.children);
  const selectedChildId =
    (loc.selectedChildId &&
    children.some((child) => child.id === loc.selectedChildId)
      ? loc.selectedChildId
      : null) ??
    (rem.selectedChildId &&
    children.some((child) => child.id === rem.selectedChildId)
      ? rem.selectedChildId
      : null) ??
    children[0]?.id ??
    null;
  const selected = children.find((child) => child.id === selectedChildId);
  return normalizeFamilyState({
    version: 1,
    children,
    selectedChildId,
    favourites: uniqueStrings(loc.favourites, rem.favourites),
    enrolled: uniqueStrings(loc.enrolled, rem.enrolled),
    enrolledByChild: mergeEnrolledByChild(loc, rem, children.map((c) => c.id)),
    includeInterstate: loc.includeInterstate || rem.includeInterstate,
    preferredState:
      loc.preferredState ?? rem.preferredState ?? selected?.homeState ?? null,
    reminderPrefs: loc.reminderPrefs,
    notifiedReminderIds: uniqueStrings(
      loc.notifiedReminderIds,
      rem.notifiedReminderIds,
    ),
    results: mergeById(loc.results, rem.results),
  });
}

export function reconcileFamilyState(
  local: FamilyState,
  remote: FamilyState | null,
  lastOwnerId: string | null,
  userId: string,
): FamilyState {
  const loc = normalizeFamilyState(local);
  if (lastOwnerId && lastOwnerId !== userId) {
    return remote ? normalizeFamilyState(remote) : defaultFamilyState;
  }
  if (!remote) return loc;
  const rem = normalizeFamilyState(remote);
  if (isEmptyFamily(loc)) return rem;
  if (isEmptyFamily(rem)) return loc;
  return mergeFamilyState(loc, rem);
}

function asReminderPrefs(value: unknown): ReminderPrefs {
  if (!value || typeof value !== "object") return defaultReminderPrefs;
  const raw = value as Record<string, unknown>;
  return {
    onOpen:
      typeof raw.onOpen === "boolean"
        ? raw.onOpen
        : defaultReminderPrefs.onOpen,
    weekBeforeClose:
      typeof raw.weekBeforeClose === "boolean"
        ? raw.weekBeforeClose
        : defaultReminderPrefs.weekBeforeClose,
    dayBeforeClose:
      typeof raw.dayBeforeClose === "boolean"
        ? raw.dayBeforeClose
        : defaultReminderPrefs.dayBeforeClose,
  };
}

export async function pullFamilyState(
  userId: string,
): Promise<FamilyState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [
    profileRes,
    childrenRes,
    favouritesRes,
    enrolledRes,
    enrolledByChildRes,
    resultsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("children").select("*").eq("user_id", userId),
    supabase.from("favourites").select("comp_id").eq("user_id", userId),
    supabase.from("enrolled_comps").select("comp_id").eq("user_id", userId),
    supabase
      .from("enrolled_by_child")
      .select("child_id, comp_id")
      .eq("user_id", userId),
    supabase.from("results").select("*").eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (childrenRes.error) throw childrenRes.error;
  if (favouritesRes.error) throw favouritesRes.error;
  if (enrolledRes.error) throw enrolledRes.error;
  if (resultsRes.error) throw resultsRes.error;
  // enrolled_by_child is new; treat a missing table as empty per-child sets.
  const enrolledByChildRows = enrolledByChildRes.error
    ? []
    : (enrolledByChildRes.data ?? []);

  if (!profileRes.data && !(childrenRes.data && childrenRes.data.length)) {
    return null;
  }

  const profile = (profileRes.data ?? null) as ProfileRow | null;
  const childRows = (childrenRes.data ?? []) as ChildRow[];
  const children: ChildProfile[] = childRows.map((row) => ({
    id: row.id,
    name: row.name,
    dob: row.dob ?? "",
    styles: Array.isArray(row.styles) ? (row.styles as ChildProfile["styles"]) : [],
    studio: row.studio ?? "",
    homeState: isAuStateCode(row.home_state) ? row.home_state : "SA",
  }));

  const resultRows = (resultsRes.data ?? []) as ResultRow[];
  const results: CompResult[] = resultRows.map((row) => ({
    id: row.id,
    childId: row.child_id,
    compId: row.comp_id,
    compName: row.comp_name ?? "Competition",
    date: row.date ?? "",
    section: row.section ?? "",
    placing: row.placing ?? "",
    score: row.score ?? "",
    notes: row.notes ?? "",
  }));

  const enrolledByChild: Record<string, string[]> = {};
  for (const row of enrolledByChildRows) {
    const childId = row.child_id as string;
    const compId = row.comp_id as string;
    if (!childId || !compId) continue;
    if (!enrolledByChild[childId]) enrolledByChild[childId] = [];
    enrolledByChild[childId].push(compId);
  }

  return normalizeFamilyState({
    version: 1,
    children,
    selectedChildId: profile?.selected_child_id ?? null,
    favourites: (favouritesRes.data ?? []).map((row) => row.comp_id as string),
    enrolled: (enrolledRes.data ?? []).map((row) => row.comp_id as string),
    enrolledByChild,
    includeInterstate: Boolean(profile?.include_interstate),
    preferredState: profile?.preferred_state ?? null,
    reminderPrefs: asReminderPrefs(profile?.reminder_prefs),
    notifiedReminderIds: profile?.notified_reminder_ids ?? [],
    results,
  });
}

export async function pushFamilyState(
  userId: string,
  state: FamilyState,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const next = normalizeFamilyState(state);

  const profileError = (
    await supabase.from("profiles").upsert({
      id: userId,
      selected_child_id: next.selectedChildId,
      include_interstate: next.includeInterstate,
      preferred_state: next.preferredState,
      reminder_prefs: next.reminderPrefs,
      notified_reminder_ids: next.notifiedReminderIds,
    })
  ).error;
  if (profileError) throw profileError;

  const existingChildren = await supabase
    .from("children")
    .select("id")
    .eq("user_id", userId);
  if (existingChildren.error) throw existingChildren.error;
  const keepChildren = new Set(next.children.map((child) => child.id));
  const extraChildren = (existingChildren.data ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepChildren.has(id));
  if (extraChildren.length > 0) {
    const del = await supabase.from("children").delete().in("id", extraChildren);
    if (del.error) throw del.error;
  }
  if (next.children.length > 0) {
    const upsert = await supabase.from("children").upsert(
      next.children.map((child) => ({
        id: child.id,
        user_id: userId,
        name: child.name,
        dob: child.dob,
        styles: child.styles,
        studio: child.studio,
        home_state: child.homeState,
      })),
    );
    if (upsert.error) throw upsert.error;
  }

  const existingResults = await supabase
    .from("results")
    .select("id")
    .eq("user_id", userId);
  if (existingResults.error) throw existingResults.error;
  const keepResults = new Set(next.results.map((result) => result.id));
  const extraResults = (existingResults.data ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepResults.has(id));
  if (extraResults.length > 0) {
    const del = await supabase.from("results").delete().in("id", extraResults);
    if (del.error) throw del.error;
  }
  if (next.results.length > 0) {
    const upsert = await supabase.from("results").upsert(
      next.results.map((result) => ({
        id: result.id,
        user_id: userId,
        child_id: result.childId,
        comp_id: result.compId,
        comp_name: result.compName,
        date: result.date,
        section: result.section,
        placing: result.placing,
        score: result.score,
        notes: result.notes,
      })),
    );
    if (upsert.error) throw upsert.error;
  }

  const favDelete = await supabase.from("favourites").delete().eq("user_id", userId);
  if (favDelete.error) throw favDelete.error;
  if (next.favourites.length > 0) {
    const insert = await supabase.from("favourites").insert(
      next.favourites.map((compId) => ({ user_id: userId, comp_id: compId })),
    );
    if (insert.error) throw insert.error;
  }

  const enrolledDelete = await supabase
    .from("enrolled_comps")
    .delete()
    .eq("user_id", userId);
  if (enrolledDelete.error) throw enrolledDelete.error;
  if (next.enrolled.length > 0) {
    const insert = await supabase.from("enrolled_comps").insert(
      next.enrolled.map((compId) => ({ user_id: userId, comp_id: compId })),
    );
    if (insert.error) throw insert.error;
  }

  const byChildDelete = await supabase
    .from("enrolled_by_child")
    .delete()
    .eq("user_id", userId);
  if (byChildDelete.error) throw byChildDelete.error;
  const byChildRows: { user_id: string; child_id: string; comp_id: string }[] =
    [];
  for (const [childId, ids] of Object.entries(next.enrolledByChild ?? {})) {
    for (const compId of ids) {
      byChildRows.push({ user_id: userId, child_id: childId, comp_id: compId });
    }
  }
  if (byChildRows.length > 0) {
    const insert = await supabase.from("enrolled_by_child").insert(byChildRows);
    if (insert.error) throw insert.error;
  }
}
