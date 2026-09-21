import { ageAsAtCompYear } from "./age";
import { registrationStatus } from "./comps";
import { adelaideToday, calendarDate } from "./datetime";
import type {
  AuStateCode,
  ChildProfile,
  Competition,
  RegistrationStatus,
} from "./types";

/** Soonest first (default) or latest first, relative to Adelaide today. */
export type DateSortDir = "asc" | "desc";

export interface CompFilters {
  query: string;
  includeInterstate: boolean;
  child: ChildProfile | null;
  /**
   * Home state for the main list when no child is selected.
   * Ignored for the state check when a child is selected (child.homeState wins).
   */
  homeState?: AuStateCode | null;
  onlyFavourites?: boolean;
  favouriteIds?: string[];
  sortDir?: DateSortDir;
  /** Empty / omitted = all statuses. */
  statuses?: RegistrationStatus[];
  now?: Date;
}

/**
 * Comparable date for list sorting.
 * Uses event start date; if missing, falls back to end date, then
 * registration open, then registration close. Empty string means undated
 * (those comps sort last in both directions).
 */
export function compDateSortKey(comp: Competition): string {
  const candidates = [
    comp.startDate,
    comp.endDate,
    comp.registrationOpens,
    comp.registrationCloses,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * True when the event start (Adelaide calendar date) is today or later.
 * Already-started comps — even if the end date is still in the future — are
 * treated as past so they cannot rank as “soonest” ahead of future starts.
 */
export function compIsUpcoming(comp: Competition, today: string): boolean {
  const start = calendarDate(compDateSortKey(comp));
  if (!start) return false;
  return start >= today;
}

/**
 * Date sort relative to Adelaide today — not a raw chronological dump.
 *
 * Choice (documented): keep past comps in the list, but always after
 * upcoming ones (start date today or later in Australia/Adelaide).
 * - Soonest first: nearest future/current start, then past by most recent.
 * - Latest first: farthest-future start, then past by most recent.
 * Undated comps stay last in both directions.
 */
export function compareCompsByDate(
  a: Competition,
  b: Competition,
  dir: DateSortDir = "asc",
  now: Date = new Date(),
): number {
  const ka = compDateSortKey(a);
  const kb = compDateSortKey(b);
  if (!ka && !kb) return a.id.localeCompare(b.id);
  if (!ka) return 1;
  if (!kb) return -1;

  const today = adelaideToday(now);
  const aUpcoming = compIsUpcoming(a, today);
  const bUpcoming = compIsUpcoming(b, today);
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

  const cmp = ka.localeCompare(kb);
  if (cmp !== 0) {
    if (aUpcoming) return dir === "desc" ? -cmp : cmp;
    return -cmp;
  }
  return a.id.localeCompare(b.id);
}

export function stylesOverlap(
  childStyles: string[] | null | undefined,
  compStyles: string[] | null | undefined,
): boolean {
  const child = Array.isArray(childStyles) ? childStyles : [];
  const comp = Array.isArray(compStyles) ? compStyles : [];
  if (child.length === 0) return true;
  const set = new Set(comp.map((s) => s.toLowerCase()));
  return child.some((s) => set.has(s.toLowerCase()));
}

export function resolveHomeState(
  child: ChildProfile | null,
  preferredState?: AuStateCode | null,
): AuStateCode | null {
  return child?.homeState ?? preferredState ?? null;
}

/**
 * Home-state comps plus events tagged National. Other states only when
 * “Include interstate comps” is on.
 *
 * When interstate is off and no home state is known, nothing matches — the
 * UI should prompt for a state rather than listing Australia-wide.
 */
export function matchesHomeState(
  comp: Competition,
  homeState: AuStateCode | null,
  includeInterstate: boolean,
): boolean {
  if (includeInterstate) return true;
  if (!homeState) return false;
  if (comp.isNational) return true;
  return comp.state === homeState;
}

export function matchesChild(
  comp: Competition,
  child: ChildProfile,
  includeInterstate: boolean,
): boolean {
  if (!comp.startDate) return false;
  const age = ageAsAtCompYear(child.dob, comp.startDate);
  const minOk = comp.minAge == null || age >= comp.minAge;
  const maxOk = comp.maxAge == null || age <= comp.maxAge;
  if (!minOk || !maxOk) return false;
  if (!stylesOverlap(child.styles, comp.styles)) return false;
  return matchesHomeState(comp, child.homeState, includeInterstate);
}

export function searchMatches(comp: Competition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const styles = Array.isArray(comp.styles) ? comp.styles : [];
  const hay = [
    comp.name,
    comp.organiser,
    comp.suburb,
    comp.venue,
    comp.state,
    comp.notes,
    ...styles,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterComps(
  comps: Competition[],
  filters: CompFilters,
): Competition[] {
  const list = Array.isArray(comps) ? comps : [];
  const homeState = resolveHomeState(filters.child, filters.homeState);
  return list
    .filter((comp) => {
      if (!comp?.id || !comp.startDate) return false;
      if (filters.onlyFavourites) {
        if (!filters.favouriteIds?.includes(comp.id)) return false;
      }
      if (!searchMatches(comp, filters.query)) return false;
      if (filters.statuses && filters.statuses.length > 0) {
        const status = registrationStatus(comp, filters.now);
        if (!filters.statuses.includes(status)) return false;
      }
      if (filters.child) {
        return matchesChild(comp, filters.child, filters.includeInterstate);
      }
      return matchesHomeState(comp, homeState, filters.includeInterstate);
    })
    .sort((a, b) =>
      compareCompsByDate(a, b, filters.sortDir ?? "asc", filters.now),
    );
}
