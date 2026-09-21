import type { DateSortDir } from "./filter";
import { isRegistrationStatus } from "./comps";
import { normalizeEnrolledByChild } from "./enrolled";
import { isAuStateCode, AU_STATES } from "./types";
import type {
  AuStateCode,
  ChildProfile,
  CompResult,
  DanceStyle,
  FamilyState,
  RegistrationStatus,
  ReminderPrefs,
} from "./types";

export const STORAGE_KEY = "mydancecomps.family.v1";
export const LEGACY_STORAGE_KEYS = [
  "mydancecomps.family",
  "mydancecomps.family.v0",
  "my-dance-comps.family",
];
export const COMPS_DATE_SORT_KEY = "mydancecomps.compsDateSort";
export const COMPS_STATUS_FILTER_KEY = "mydancecomps.compsStatusFilter";
export const SOFT_MAX_KIDS = 20;

export const defaultReminderPrefs: ReminderPrefs = {
  onOpen: true,
  weekBeforeClose: true,
  dayBeforeClose: true,
};

export const defaultFamilyState: FamilyState = {
  version: 1,
  children: [],
  selectedChildId: null,
  favourites: [],
  enrolled: [],
  enrolledByChild: {},
  includeInterstate: false,
  preferredState: null,
  reminderPrefs: defaultReminderPrefs,
  notifiedReminderIds: [],
  results: [],
};

const AU_STATE_CODES = new Set<string>(AU_STATES.map((s) => s.code));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeHomeState(value: unknown): AuStateCode {
  const code = asString(value, "SA").toUpperCase();
  return (AU_STATE_CODES.has(code) ? code : "SA") as AuStateCode;
}

export function normalizeChild(raw: unknown): ChildProfile | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id).trim();
  const name = asString(raw.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    dob: asString(raw.dob),
    styles: asStringArray(raw.styles) as DanceStyle[],
    studio: asString(raw.studio),
    homeState: normalizeHomeState(raw.homeState),
  };
}

export function normalizeResult(raw: unknown): CompResult | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id).trim();
  const childId = asString(raw.childId).trim();
  if (!id || !childId) return null;
  const compIdRaw = raw.compId;
  return {
    id,
    childId,
    compId: typeof compIdRaw === "string" && compIdRaw ? compIdRaw : null,
    compName: asString(raw.compName, "Competition"),
    date: asString(raw.date),
    section: asString(raw.section),
    placing: asString(raw.placing),
    score: asString(raw.score),
    notes: asString(raw.notes),
  };
}

export function derivePreferredState(
  parsed: Partial<FamilyState>,
): AuStateCode | null {
  if (isAuStateCode(parsed.preferredState)) return parsed.preferredState;
  const children = parsed.children ?? [];
  const selected = children.find((c) => c.id === parsed.selectedChildId);
  if (selected && isAuStateCode(selected.homeState)) return selected.homeState;
  const first = children[0];
  if (first && isAuStateCode(first.homeState)) return first.homeState;
  return null;
}

export function normalizeFamilyState(raw: unknown): FamilyState {
  if (!isRecord(raw)) return defaultFamilyState;
  const children = Array.isArray(raw.children)
    ? raw.children
        .map(normalizeChild)
        .filter((child): child is ChildProfile => child !== null)
        .slice(0, SOFT_MAX_KIDS)
    : [];
  const selectedRaw = raw.selectedChildId;
  const selectedChildId =
    typeof selectedRaw === "string" &&
    children.some((child) => child.id === selectedRaw)
      ? selectedRaw
      : null;
  const reminderRaw = isRecord(raw.reminderPrefs) ? raw.reminderPrefs : {};
  return {
    version: 1,
    children,
    selectedChildId,
    favourites: asStringArray(raw.favourites),
    enrolled: asStringArray(raw.enrolled),
    enrolledByChild: normalizeEnrolledByChild(
      raw.enrolledByChild,
      children.map((child) => child.id),
    ),
    includeInterstate: asBoolean(raw.includeInterstate, false),
    preferredState: derivePreferredState({
      preferredState: isAuStateCode(raw.preferredState)
        ? raw.preferredState
        : null,
      children,
      selectedChildId,
    }),
    reminderPrefs: {
      onOpen: asBoolean(reminderRaw.onOpen, defaultReminderPrefs.onOpen),
      weekBeforeClose: asBoolean(
        reminderRaw.weekBeforeClose,
        defaultReminderPrefs.weekBeforeClose,
      ),
      dayBeforeClose: asBoolean(
        reminderRaw.dayBeforeClose,
        defaultReminderPrefs.dayBeforeClose,
      ),
    },
    notifiedReminderIds: asStringArray(raw.notifiedReminderIds),
    results: Array.isArray(raw.results)
      ? raw.results
          .map(normalizeResult)
          .filter((result): result is CompResult => result !== null)
      : [],
  };
}

function wipeStorageKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* private mode / quota */
  }
}

export function loadFamilyState(): FamilyState {
  if (typeof window === "undefined") return defaultFamilyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const legacy of LEGACY_STORAGE_KEYS) {
        try {
          window.localStorage.removeItem(legacy);
        } catch {
          /* ignore */
        }
      }
      return defaultFamilyState;
    }
    const parsed: unknown = JSON.parse(raw);
    return normalizeFamilyState(parsed);
  } catch {
    wipeStorageKey(STORAGE_KEY);
    return defaultFamilyState;
  }
}

export function saveFamilyState(state: FamilyState) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeFamilyState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* Safari private mode and quota errors must not crash the UI */
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isDateSortDir(value: unknown): value is DateSortDir {
  return value === "asc" || value === "desc";
}

export function loadCompsDateSort(): DateSortDir {
  if (typeof window === "undefined") return "asc";
  try {
    const raw = window.localStorage.getItem(COMPS_DATE_SORT_KEY);
    return isDateSortDir(raw) ? raw : "asc";
  } catch {
    return "asc";
  }
}

export function saveCompsDateSort(dir: DateSortDir) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPS_DATE_SORT_KEY, dir);
  } catch {
    /* private mode / quota */
  }
}

const EMPTY_STATUSES: RegistrationStatus[] = [];
let cachedStatuses: RegistrationStatus[] | null = null;

export function loadCompsStatusFilter(): RegistrationStatus[] {
  if (cachedStatuses) return cachedStatuses;
  if (typeof window === "undefined") return EMPTY_STATUSES;
  try {
    const raw = window.localStorage.getItem(COMPS_STATUS_FILTER_KEY);
    if (!raw) {
      cachedStatuses = EMPTY_STATUSES;
      return cachedStatuses;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cachedStatuses = EMPTY_STATUSES;
      return cachedStatuses;
    }
    const next = parsed.filter(isRegistrationStatus);
    cachedStatuses = next.length === 0 ? EMPTY_STATUSES : next;
    return cachedStatuses;
  } catch {
    cachedStatuses = EMPTY_STATUSES;
    return cachedStatuses;
  }
}

export function saveCompsStatusFilter(statuses: RegistrationStatus[]) {
  const next = statuses.filter(isRegistrationStatus);
  cachedStatuses = next.length === 0 ? EMPTY_STATUSES : next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMPS_STATUS_FILTER_KEY,
      JSON.stringify(cachedStatuses),
    );
  } catch {
    /* private mode / quota */
  }
}
