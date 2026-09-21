import { ageAsAtCompYear } from "./age";
import type { ChildProfile, Competition } from "./types";

export interface CompFilters {
  query: string;
  includeInterstate: boolean;
  child: ChildProfile | null;
  onlyFavourites?: boolean;
  favouriteIds?: string[];
}

export function stylesOverlap(
  childStyles: string[],
  compStyles: string[],
): boolean {
  if (childStyles.length === 0) return true;
  const set = new Set(compStyles.map((s) => s.toLowerCase()));
  return childStyles.some((s) => set.has(s.toLowerCase()));
}

export function matchesChild(
  comp: Competition,
  child: ChildProfile,
  includeInterstate: boolean,
): boolean {
  const age = ageAsAtCompYear(child.dob, comp.startDate);
  const minOk = comp.minAge == null || age >= comp.minAge;
  const maxOk = comp.maxAge == null || age <= comp.maxAge;
  if (!minOk || !maxOk) return false;
  if (!stylesOverlap(child.styles, comp.styles)) return false;
  if (includeInterstate || comp.isNational) return true;
  return comp.state === child.homeState;
}

export function searchMatches(comp: Competition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    comp.name,
    comp.organiser,
    comp.suburb,
    comp.venue,
    comp.state,
    comp.notes,
    ...comp.styles,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterComps(
  comps: Competition[],
  filters: CompFilters,
): Competition[] {
  return comps
    .filter((comp) => {
      if (filters.onlyFavourites) {
        if (!filters.favouriteIds?.includes(comp.id)) return false;
      }
      if (!searchMatches(comp, filters.query)) return false;
      if (filters.child) {
        return matchesChild(comp, filters.child, filters.includeInterstate);
      }
      return true;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
