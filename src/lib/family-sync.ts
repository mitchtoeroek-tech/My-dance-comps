import type { AccountRole } from "./account";
import { parseStudioId } from "./studios";
import { getSupabase } from "./supabase";
import {
  defaultFamilyState,
  normalizeFamilyState,
  normalizeReminderPrefs,
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
  studio_id?: string | null;
  home_state: string | null;
  linked_user_id?: string | null;
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

function mergeChildren(local: ChildProfile[], remote: ChildProfile[]): ChildProfile[] {
  const map = new Map<string, ChildProfile>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const linkedUserId = item.linkedUserId ?? prev.linkedUserId;
    map.set(item.id, linkedUserId ? { ...prev, ...item, linkedUserId } : { ...prev, ...item });
  }
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
    const locIds = localHas ? (local.enrolledByChild[id] ?? []) : [];
    const remIds = remoteHas ? (remote.enrolledByChild[id] ?? []) : [];
    out[id] = uniqueStrings(locIds, remIds);
  }
  return out;
}

export function isEmptyFamily(state: FamilyState): boolean {
  return (
    state.children.length === 0 &&
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
  const children = mergeChildren(loc.children, rem.children);
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

export interface DancerFamilyMode {
  role: AccountRole;
  linkedChildId: string | null;
}

/** Linked dancers only see their own profile. Parents keep the household. */
export function scopeDancerFamily(
  state: FamilyState,
  mode: DancerFamilyMode | null,
): FamilyState {
  if (!mode || mode.role !== "dancer") return state;
  const children = Array.isArray(state.children) ? state.children : [];
  if (mode.linkedChildId) {
    const linked = children.find((child) => child.id === mode.linkedChildId);
    if (!linked) return state;
    return {
      ...state,
      children: [linked],
      selectedChildId: linked.id,
      preferredState: state.preferredState ?? linked.homeState,
    };
  }
  if (children.length === 0) return state;
  const selected =
    children.find((child) => child.id === state.selectedChildId) ?? children[0];
  if (!selected) return state;
  return {
    ...state,
    selectedChildId: selected.id,
    preferredState: state.preferredState ?? selected.homeState,
  };
}

/**
 * After a dancer joins a family, the linked child on the parent account is
 * the profile they use. Guest drafts and sibling rows stay out of their view.
 */
export function reconcileDancerLinkedState(
  local: FamilyState,
  remote: FamilyState | null,
): FamilyState {
  if (!remote) return normalizeFamilyState(local);
  const loc = normalizeFamilyState(local);
  const rem = normalizeFamilyState(remote);
  if (rem.children.length === 0) return loc;
  const selected = rem.children[0];
  return normalizeFamilyState({
    ...rem,
    includeInterstate: loc.includeInterstate || rem.includeInterstate,
    preferredState:
      rem.preferredState ?? loc.preferredState ?? selected?.homeState ?? null,
    reminderPrefs: loc.reminderPrefs,
    notifiedReminderIds: uniqueStrings(
      loc.notifiedReminderIds,
      rem.notifiedReminderIds,
    ),
    selectedChildId: selected?.id ?? null,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function familyStateFromDancerSnapshot(raw: unknown): {
  linked: boolean;
  state: FamilyState | null;
} {
  const row = asRecord(raw);
  if (!row || row.linked !== true) return { linked: false, state: null };
  const childRaw = asRecord(row.child);
  const id = typeof childRaw?.id === "string" ? childRaw.id : "";
  const name = typeof childRaw?.name === "string" ? childRaw.name : "";
  if (!id || !name) return { linked: false, state: null };
  const linkedUserId =
    typeof childRaw?.linked_user_id === "string" ? childRaw.linked_user_id : "";
  const owned = row.enrolled_owned === true;
  const ids = asStringArray(row.enrolled_ids);
  const resultRows = Array.isArray(row.results) ? row.results : [];
  const results: CompResult[] = [];
  for (const item of resultRows) {
    const result = asRecord(item);
    if (!result || typeof result.id !== "string") continue;
    results.push({
      id: result.id,
      childId: id,
      compId: typeof result.comp_id === "string" && result.comp_id ? result.comp_id : null,
      compName:
        typeof result.comp_name === "string" && result.comp_name
          ? result.comp_name
          : "Competition",
      date: typeof result.date === "string" ? result.date : "",
      section: typeof result.section === "string" ? result.section : "",
      placing: typeof result.placing === "string" ? result.placing : "",
      score: typeof result.score === "string" ? result.score : "",
      notes: typeof result.notes === "string" ? result.notes : "",
    });
  }
  const child: ChildProfile = {
    id,
    name,
    dob: typeof childRaw?.dob === "string" ? childRaw.dob : "",
    styles: asStringArray(childRaw?.styles) as ChildProfile["styles"],
    studio: typeof childRaw?.studio === "string" ? childRaw.studio : "",
    studioId: parseStudioId(childRaw?.studio_id),
    homeState: isAuStateCode(childRaw?.home_state) ? childRaw.home_state : "SA",
    ...(linkedUserId ? { linkedUserId } : {}),
  };
  return {
    linked: true,
    state: normalizeFamilyState({
      version: 1,
      children: [child],
      selectedChildId: id,
      enrolled: owned ? [] : ids,
      enrolledByChild: owned ? { [id]: ids } : {},
      includeInterstate: row.include_interstate === true,
      preferredState: row.preferred_state,
      reminderPrefs: row.reminder_prefs,
      notifiedReminderIds: asStringArray(row.notified_reminder_ids),
      results,
    }),
  };
}

export function dancerPushPayload(
  state: FamilyState,
): Record<string, unknown> | null {
  const child = state.children[0];
  if (!child) return null;
  const owned = Object.prototype.hasOwnProperty.call(
    state.enrolledByChild,
    child.id,
  );
  return {
    child: {
      name: child.name,
      dob: child.dob,
      styles: child.styles,
      studio: child.studio,
      studio_id: parseStudioId(child.studioId),
      home_state: child.homeState,
    },
    enrolled_owned: owned,
    enrolled_ids: owned ? (state.enrolledByChild[child.id] ?? []) : [],
    include_interstate: state.includeInterstate,
    preferred_state: state.preferredState,
    reminder_prefs: state.reminderPrefs,
    notified_reminder_ids: state.notifiedReminderIds,
    results: state.results
      .filter((result) => result.childId === child.id)
      .map((result) => ({
        id: result.id,
        comp_id: result.compId,
        comp_name: result.compName,
        date: result.date,
        section: result.section,
        placing: result.placing,
        score: result.score,
        notes: result.notes,
      })),
  };
}

function isMissingColumn(
  error: { message?: string; code?: string } | null,
  column: string,
): boolean {
  const message = (error?.message ?? "").toLowerCase();
  const code = error?.code ?? "";
  return (
    code === "PGRST204" ||
    code === "42703" ||
    (message.includes(column.toLowerCase()) &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find")))
  );
}

function asReminderPrefs(value: unknown): ReminderPrefs {
  return normalizeReminderPrefs(value);
}

export async function pullFamilyState(
  userId: string,
): Promise<FamilyState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [
    profileRes,
    childrenRes,
    enrolledRes,
    enrolledByChildRes,
    enrolledSetsRes,
    resultsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("children").select("*").eq("user_id", userId),
    supabase.from("enrolled_comps").select("comp_id").eq("user_id", userId),
    supabase
      .from("enrolled_by_child")
      .select("child_id, comp_id")
      .eq("user_id", userId),
    supabase.from("enrolled_child_sets").select("child_id").eq("user_id", userId),
    supabase.from("results").select("*").eq("user_id", userId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (childrenRes.error) throw childrenRes.error;
  if (enrolledRes.error) throw enrolledRes.error;
  if (resultsRes.error) throw resultsRes.error;
  // enrolled_by_child is new; treat a missing table as empty per-child sets.
  const enrolledByChildRows = enrolledByChildRes.error
    ? []
    : (enrolledByChildRes.data ?? []);
  const enrolledSetRows = enrolledSetsRes.error
    ? []
    : (enrolledSetsRes.data ?? []);

  if (!profileRes.data && !(childrenRes.data && childrenRes.data.length)) {
    return null;
  }

  const profile = (profileRes.data ?? null) as ProfileRow | null;
  const childRows = (childrenRes.data ?? []) as ChildRow[];
  const children: ChildProfile[] = childRows.map((row) => {
    const linkedUserId =
      typeof row.linked_user_id === "string" ? row.linked_user_id : "";
    return {
      id: row.id,
      name: row.name,
      dob: row.dob ?? "",
      styles: Array.isArray(row.styles) ? (row.styles as ChildProfile["styles"]) : [],
      studio: row.studio ?? "",
      studioId: parseStudioId(row.studio_id),
      homeState: isAuStateCode(row.home_state) ? row.home_state : "SA",
      ...(linkedUserId ? { linkedUserId } : {}),
    };
  });

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
  for (const row of enrolledSetRows) {
    const childId = row.child_id as string;
    if (childId) enrolledByChild[childId] = [];
  }
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
        studio_id: parseStudioId(child.studioId),
        home_state: child.homeState,
      })),
    );
    if (upsert.error && isMissingColumn(upsert.error, "studio_id")) {
      const retry = await supabase.from("children").upsert(
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
      if (retry.error) throw retry.error;
    } else if (upsert.error) {
      throw upsert.error;
    }
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
  const setRows: { user_id: string; child_id: string }[] = [];
  for (const [childId, ids] of Object.entries(next.enrolledByChild ?? {})) {
    setRows.push({ user_id: userId, child_id: childId });
    for (const compId of ids) {
      byChildRows.push({ user_id: userId, child_id: childId, comp_id: compId });
    }
  }
  if (byChildRows.length > 0) {
    const insert = await supabase.from("enrolled_by_child").insert(byChildRows);
    if (insert.error) throw insert.error;
  }

  const setsDelete = await supabase
    .from("enrolled_child_sets")
    .delete()
    .eq("user_id", userId);
  if (setsDelete.error) throw setsDelete.error;
  if (setRows.length > 0) {
    const insert = await supabase.from("enrolled_child_sets").insert(setRows);
    if (insert.error) throw insert.error;
  }
}

export async function pullDancerLinkedState(): Promise<{
  linked: boolean;
  state: FamilyState | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { linked: false, state: null };
  const { data, error } = await supabase.rpc("dancer_pull_state");
  if (error) throw error;
  return familyStateFromDancerSnapshot(data);
}

export async function pushDancerLinkedState(state: FamilyState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const payload = dancerPushPayload(normalizeFamilyState(state));
  if (!payload) return;
  const { error } = await supabase.rpc("dancer_push_state", { p_state: payload });
  if (error) throw error;
}
