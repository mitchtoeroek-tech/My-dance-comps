import type { AccountRole } from "./account";
import { enrolledIdsForChild } from "./enrolled";
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
  // This device already synced this account. The cache must not union old
  // enrolments back in or overwrite a studio saved on another login.
  if (lastOwnerId === userId) return rebaseHouseholdEdits(loc, loc, rem);
  return mergeFamilyState(loc, rem);
}

export function familyStatesEqual(a: FamilyState, b: FamilyState): boolean {
  return (
    JSON.stringify(normalizeFamilyState(a)) ===
    JSON.stringify(normalizeFamilyState(b))
  );
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function rebaseIdList(base: string[], edited: string[], cloud: string[]): string[] {
  const baseSet = new Set(base);
  const editSet = new Set(edited);
  const cloudSet = new Set(cloud);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...cloud, ...edited, ...base]) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    const changed = editSet.has(id) !== baseSet.has(id);
    const keep = changed ? editSet.has(id) : cloudSet.has(id);
    if (keep) out.push(id);
  }
  return out;
}

function rebaseChildFields(
  base: ChildProfile | undefined,
  edited: ChildProfile,
  cloud: ChildProfile,
): ChildProfile {
  if (!base) return edited;
  const next: ChildProfile = { ...cloud };
  if (!sameJson(base.name, edited.name)) next.name = edited.name;
  if (!sameJson(base.dob, edited.dob)) next.dob = edited.dob;
  if (!sameJson(base.styles, edited.styles)) next.styles = edited.styles;
  if (!sameJson(base.studio, edited.studio)) next.studio = edited.studio;
  if (!sameJson(base.studioId ?? null, edited.studioId ?? null)) {
    next.studioId = edited.studioId ?? null;
  }
  if (!sameJson(base.homeState, edited.homeState)) next.homeState = edited.homeState;
  if (!sameJson(base.linkedUserId ?? null, edited.linkedUserId ?? null)) {
    if (edited.linkedUserId) next.linkedUserId = edited.linkedUserId;
    else delete next.linkedUserId;
  }
  return next;
}

function rebaseResults(
  base: FamilyState,
  edited: FamilyState,
  cloud: FamilyState,
): CompResult[] {
  const baseMap = new Map(base.results.map((result) => [result.id, result]));
  const editMap = new Map(edited.results.map((result) => [result.id, result]));
  const cloudMap = new Map(cloud.results.map((result) => [result.id, result]));
  const ids = new Set([...cloudMap.keys(), ...editMap.keys(), ...baseMap.keys()]);
  const out: CompResult[] = [];
  for (const id of ids) {
    const before = baseMap.get(id);
    const local = editMap.get(id);
    const remote = cloudMap.get(id);
    if (before && !local) continue;
    if (local && !before) {
      out.push(local);
      continue;
    }
    if (local && before && !sameJson(before, local)) {
      out.push(local);
      continue;
    }
    if (remote) out.push(remote);
  }
  return out;
}

/**
 * Cloud household wins for anything this session did not change.
 * A studio or enrolment edit made after `baseline` is kept; a stale device
 * cache is not written back over the server.
 */
export function rebaseHouseholdEdits(
  baseline: FamilyState,
  edited: FamilyState,
  remote: FamilyState,
): FamilyState {
  const base = normalizeFamilyState(baseline);
  const edit = normalizeFamilyState(edited);
  const cloud = normalizeFamilyState(remote);
  const baseById = new Map(base.children.map((child) => [child.id, child]));
  const editById = new Map(edit.children.map((child) => [child.id, child]));
  const removed = new Set(
    base.children
      .filter((child) => !editById.has(child.id))
      .map((child) => child.id),
  );
  const children: ChildProfile[] = [];
  for (const cloudChild of cloud.children) {
    if (removed.has(cloudChild.id)) continue;
    const local = editById.get(cloudChild.id);
    if (!local) {
      children.push(cloudChild);
      continue;
    }
    children.push(rebaseChildFields(baseById.get(cloudChild.id), local, cloudChild));
  }
  for (const local of edit.children) {
    if (cloud.children.some((child) => child.id === local.id)) continue;
    const before = baseById.get(local.id);
    if (!before || !sameJson(before, local)) children.push(local);
  }

  const childIds = children.map((child) => child.id);
  const enrolledByChild: Record<string, string[]> = {};
  for (const id of childIds) {
    const had =
      Object.prototype.hasOwnProperty.call(base.enrolledByChild, id) ||
      Object.prototype.hasOwnProperty.call(edit.enrolledByChild, id) ||
      Object.prototype.hasOwnProperty.call(cloud.enrolledByChild, id);
    if (!had) continue;
    enrolledByChild[id] = rebaseIdList(
      enrolledIdsForChild(base.enrolled, base.enrolledByChild, id),
      enrolledIdsForChild(edit.enrolled, edit.enrolledByChild, id),
      enrolledIdsForChild(cloud.enrolled, cloud.enrolledByChild, id),
    );
  }

  const selectedChanged = edit.selectedChildId !== base.selectedChildId;
  const selectedCandidate = selectedChanged
    ? edit.selectedChildId
    : cloud.selectedChildId;
  const selectedChildId =
    (selectedCandidate && childIds.includes(selectedCandidate)
      ? selectedCandidate
      : null) ??
    (cloud.selectedChildId && childIds.includes(cloud.selectedChildId)
      ? cloud.selectedChildId
      : null) ??
    childIds[0] ??
    null;

  return normalizeFamilyState({
    version: 1,
    children,
    selectedChildId,
    enrolled: rebaseIdList(base.enrolled, edit.enrolled, cloud.enrolled),
    enrolledByChild,
    includeInterstate: sameJson(base.includeInterstate, edit.includeInterstate)
      ? cloud.includeInterstate
      : edit.includeInterstate,
    preferredState: sameJson(base.preferredState, edit.preferredState)
      ? cloud.preferredState
      : edit.preferredState,
    reminderPrefs: sameJson(base.reminderPrefs, edit.reminderPrefs)
      ? cloud.reminderPrefs
      : edit.reminderPrefs,
    notifiedReminderIds: rebaseIdList(
      base.notifiedReminderIds,
      edit.notifiedReminderIds,
      cloud.notifiedReminderIds,
    ),
    results: rebaseResults(base, edit, cloud),
  });
}

export interface DancerFamilyMode {
  role: AccountRole;
  linkedChildId: string | null;
}

function resultsForChild(state: FamilyState, childId: string): FamilyState["results"] {
  const results = Array.isArray(state.results) ? state.results : [];
  return results.filter((result) => result.childId === childId);
}

/** Linked dancers only see their own profile and that profile's placings. */
export function scopeDancerFamily(
  state: FamilyState,
  mode: DancerFamilyMode | null,
): FamilyState {
  if (!mode || mode.role !== "dancer") return state;
  const children = Array.isArray(state.children) ? state.children : [];
  if (mode.linkedChildId) {
    const linked = children.find((child) => child.id === mode.linkedChildId);
    if (!linked) return state;
    const results = resultsForChild(state, linked.id);
    if (
      children.length === 1 &&
      children[0]?.id === linked.id &&
      state.selectedChildId === linked.id &&
      results.length === (state.results?.length ?? 0)
    ) {
      return state;
    }
    return {
      ...state,
      children: [linked],
      selectedChildId: linked.id,
      results,
      preferredState: state.preferredState ?? linked.homeState,
    };
  }
  if (children.length === 0) return state;
  const selected =
    children.find((child) => child.id === state.selectedChildId) ?? children[0];
  if (!selected) return state;
  const results = resultsForChild(state, selected.id);
  if (
    state.selectedChildId === selected.id &&
    results.length === (state.results?.length ?? 0)
  ) {
    return state;
  }
  return {
    ...state,
    selectedChildId: selected.id,
    results,
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

function asResultRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asResultId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
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
  const resultRows = asResultRows(row.results);
  const results: CompResult[] = [];
  for (const item of resultRows) {
    const result = asRecord(item);
    const resultId = asResultId(result?.id);
    if (!result || !resultId) continue;
    const rowChildId = asResultId(result.child_id ?? result.childId);
    results.push({
      id: resultId,
      childId: rowChildId || id,
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
  const child =
    state.children.find((item) => item.id === state.selectedChildId) ??
    state.children[0];
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

export function parseHouseholdScope(
  raw: unknown,
  selfId: string,
): { ownerId: string; familyId: string | null } {
  const row = asRecord(raw);
  const ownerId =
    typeof row?.owner_id === "string" && row.owner_id ? row.owner_id : selfId;
  const familyId =
    typeof row?.family_id === "string" && row.family_id ? row.family_id : null;
  return { ownerId, familyId };
}

async function loadHouseholdScope(
  userId: string,
): Promise<{ ownerId: string; familyId: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ownerId: userId, familyId: null };
  const { data, error } = await supabase.rpc("household_scope");
  if (error) return { ownerId: userId, familyId: null };
  return parseHouseholdScope(data, userId);
}

type ScopedError = { message?: string; code?: string } | null;

async function deleteHouseholdRows(
  familyId: string | null,
  ownerId: string,
  selfId: string,
  run: (familyId: string | null) => PromiseLike<{ error: ScopedError }>,
): Promise<{ error: ScopedError }> {
  const first = await run(familyId);
  if (
    familyId &&
    first.error &&
    isMissingColumn(first.error, "family_id") &&
    ownerId === selfId
  ) {
    return run(null);
  }
  return first;
}

async function scopedRows<T>(
  familyId: string | null,
  run: (familyId: string | null) => PromiseLike<{ data: T; error: ScopedError }>,
): Promise<{ data: T; error: ScopedError }> {
  const first = await run(familyId);
  if (familyId && first.error && isMissingColumn(first.error, "family_id")) {
    return run(null);
  }
  return first;
}

export async function pullFamilyState(
  userId: string,
): Promise<FamilyState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const scope = await loadHouseholdScope(userId);
  const ownerId = scope.ownerId;
  const [
    profileRes,
    childrenRes,
    enrolledRes,
    enrolledByChildRes,
    enrolledSetsRes,
    resultsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    scopedRows(scope.familyId, (familyId) => {
      let query = supabase.from("children").select("*").eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    }),
    scopedRows(scope.familyId, (familyId) => {
      let query = supabase
        .from("enrolled_comps")
        .select("comp_id")
        .eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    }),
    scopedRows(scope.familyId, (familyId) => {
      let query = supabase
        .from("enrolled_by_child")
        .select("child_id, comp_id")
        .eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    }),
    scopedRows(scope.familyId, (familyId) => {
      let query = supabase
        .from("enrolled_child_sets")
        .select("child_id")
        .eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    }),
    scopedRows(scope.familyId, (familyId) => {
      let query = supabase.from("results").select("*").eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    }),
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
  const scope = await loadHouseholdScope(userId);
  const ownerId = scope.ownerId;

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

  const existingChildren = await scopedRows(scope.familyId, (familyId) => {
    let query = supabase.from("children").select("id").eq("user_id", ownerId);
    if (familyId) query = query.eq("family_id", familyId);
    return query;
  });
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
        user_id: ownerId,
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
          user_id: ownerId,
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

  const existingResults = await scopedRows(scope.familyId, (familyId) => {
    let query = supabase.from("results").select("id").eq("user_id", ownerId);
    if (familyId) query = query.eq("family_id", familyId);
    return query;
  });
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
        user_id: ownerId,
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

  const enrolledDelete = await deleteHouseholdRows(
    scope.familyId,
    ownerId,
    userId,
    (familyId) => {
      let query = supabase.from("enrolled_comps").delete().eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    },
  );
  if (enrolledDelete.error) throw enrolledDelete.error;
  if (next.enrolled.length > 0) {
    const insert = await supabase.from("enrolled_comps").insert(
      next.enrolled.map((compId) => ({ user_id: ownerId, comp_id: compId })),
    );
    if (insert.error) throw insert.error;
  }

  const byChildDelete = await deleteHouseholdRows(
    scope.familyId,
    ownerId,
    userId,
    (familyId) => {
      let query = supabase
        .from("enrolled_by_child")
        .delete()
        .eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    },
  );
  if (byChildDelete.error) throw byChildDelete.error;
  const byChildRows: { user_id: string; child_id: string; comp_id: string }[] =
    [];
  const setRows: { user_id: string; child_id: string }[] = [];
  for (const [childId, ids] of Object.entries(next.enrolledByChild ?? {})) {
    setRows.push({ user_id: ownerId, child_id: childId });
    for (const compId of ids) {
      byChildRows.push({ user_id: ownerId, child_id: childId, comp_id: compId });
    }
  }
  if (byChildRows.length > 0) {
    const insert = await supabase.from("enrolled_by_child").insert(byChildRows);
    if (insert.error) throw insert.error;
  }

  const setsDelete = await deleteHouseholdRows(
    scope.familyId,
    ownerId,
    userId,
    (familyId) => {
      let query = supabase
        .from("enrolled_child_sets")
        .delete()
        .eq("user_id", ownerId);
      if (familyId) query = query.eq("family_id", familyId);
      return query;
    },
  );
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
