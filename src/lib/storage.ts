import type { FamilyState, ReminderPrefs } from "./types";

export const STORAGE_KEY = "mydancecomps.family.v1";
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
  includeInterstate: false,
  reminderPrefs: defaultReminderPrefs,
  notifiedReminderIds: [],
  results: [],
};

export function loadFamilyState(): FamilyState {
  if (typeof window === "undefined") return defaultFamilyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFamilyState;
    const parsed = JSON.parse(raw) as Partial<FamilyState>;
    return {
      ...defaultFamilyState,
      ...parsed,
      version: 1,
      reminderPrefs: {
        ...defaultReminderPrefs,
        ...(parsed.reminderPrefs ?? {}),
      },
      children: parsed.children ?? [],
      favourites: parsed.favourites ?? [],
      results: parsed.results ?? [],
      notifiedReminderIds: parsed.notifiedReminderIds ?? [],
    };
  } catch {
    return defaultFamilyState;
  }
}

export function saveFamilyState(state: FamilyState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
