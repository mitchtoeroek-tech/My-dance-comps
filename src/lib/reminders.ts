import { addDays, parseAdelaide } from "./datetime";
import { matchesHomeState, stylesOverlap } from "./filter";
import type {
  ChildProfile,
  Competition,
  ReminderItem,
  ReminderKind,
  ReminderPrefs,
} from "./types";

/**
 * Which comps can raise a reminder for this family.
 *
 * Styles: overlap with at least one dancer. A dancer with no styles selected
 * matches every competition style — the same rule as the Comps list
 * (`stylesOverlap`). The Reminders page asks the family to set styles on
 * My Dancers / My Info so that dancer stops matching everything.
 *
 * Place: the same home-state rule as the Comps list. Interstate comps are
 * included only when the family has turned that on. National events are
 * included when the styles match, even if interstate is off.
 */
export interface ReminderScope {
  children: ChildProfile[];
  includeInterstate: boolean;
  /** When this device first trusted the catalogue. Null before that. */
  baselinedAt: string | null;
  /** Comp id → ISO time it was first seen after the watermark. */
  announcedAt: Record<string, string>;
  /** Comp id → ISO time registration was first observed becoming open, when no open date is stored. */
  openedAt: Record<string, string>;
}

export function emptyReminderScope(): ReminderScope {
  return {
    children: [],
    includeInterstate: false,
    baselinedAt: null,
    announcedAt: {},
    openedAt: {},
  };
}

const NEWLY_ANNOUNCED_LOOKBACK_DAYS = 30;
const OPEN_LOOKBACK_DAYS = 14;
const UPCOMING_HORIZON_DAYS = 120;

export function dancersWithoutStyles(children: ChildProfile[]): ChildProfile[] {
  return children.filter(
    (child) => !Array.isArray(child.styles) || child.styles.length === 0,
  );
}

export function dancerMatchesComp(
  child: ChildProfile,
  comp: Competition,
  includeInterstate: boolean,
): boolean {
  if (!stylesOverlap(child.styles, comp.styles)) return false;
  return matchesHomeState(comp, child.homeState, includeInterstate);
}

/** True when any dancer’s styles and home-state rules match this comp. */
export function familyMatchesComp(
  comp: Competition,
  children: ChildProfile[],
  includeInterstate: boolean,
): boolean {
  return children.some((child) =>
    dancerMatchesComp(child, comp, includeInterstate),
  );
}

export function matchingDancerNames(
  comp: Competition,
  children: ChildProfile[],
  includeInterstate: boolean,
): string[] {
  return children
    .filter((child) => dancerMatchesComp(child, comp, includeInterstate))
    .map((child) => child.name)
    .filter(Boolean);
}

function forDancers(names: string[]): string {
  if (names.length === 0) return "Matches your dancers’ styles.";
  if (names.length === 1) return `For ${names[0]}.`;
  if (names.length === 2) return `For ${names[0]} and ${names[1]}.`;
  return `For ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
}

function kindLabel(kind: ReminderKind, name: string): string {
  switch (kind) {
    case "newly-announced":
      return `New comp — ${name}`;
    case "open":
      return `Entries open — ${name}`;
  }
}

function kindDetail(kind: ReminderKind, comp: Competition, names: string[]): string {
  const who = forDancers(names);
  switch (kind) {
    case "newly-announced":
      return `${comp.name} has just appeared in the listings. ${who}`;
    case "open":
      return `Registration opens for ${comp.name}. ${who} Head to the organiser site to enter.`;
  }
}

export function reminderKindLabel(kind: ReminderKind): string {
  switch (kind) {
    case "newly-announced":
      return "Newly announced";
    case "open":
      return "Entries open";
  }
}

/**
 * Skip open dates that had already passed before this device started watching.
 * Future open dates, and opens that fall after the watermark, still remind once.
 */
export function openReminderFireAt(
  comp: Competition,
  scope: ReminderScope,
  now = new Date(),
): string | null {
  if (comp.registrationOpens) {
    const fireAt = parseAdelaide(comp.registrationOpens);
    if (!fireAt) return null;
    if (
      scope.baselinedAt &&
      fireAt.toISOString() < scope.baselinedAt &&
      fireAt.getTime() < now.getTime()
    ) {
      return null;
    }
    return fireAt.toISOString();
  }
  return scope.openedAt[comp.id] ?? null;
}

export function remindersForComp(
  comp: Competition,
  prefs: ReminderPrefs,
  scope: ReminderScope = emptyReminderScope(),
  now = new Date(),
): ReminderItem[] {
  if (!familyMatchesComp(comp, scope.children, scope.includeInterstate)) {
    return [];
  }
  const names = matchingDancerNames(comp, scope.children, scope.includeInterstate);
  const items: ReminderItem[] = [];

  if (prefs.newlyAnnounced && scope.announcedAt[comp.id]) {
    items.push({
      id: `${comp.id}:newly-announced`,
      kind: "newly-announced",
      compId: comp.id,
      compName: comp.name,
      fireAt: scope.announcedAt[comp.id],
      label: kindLabel("newly-announced", comp.name),
      detail: kindDetail("newly-announced", comp, names),
    });
  }

  if (prefs.onOpen) {
    const fireAt = openReminderFireAt(comp, scope, now);
    if (fireAt) {
      items.push({
        id: `${comp.id}:open`,
        kind: "open",
        compId: comp.id,
        compName: comp.name,
        fireAt,
        label: kindLabel("open", comp.name),
        detail: kindDetail("open", comp, names),
      });
    }
  }

  return items;
}

export function buildReminders(
  comps: Competition[],
  prefs: ReminderPrefs,
  scope: ReminderScope,
  now = new Date(),
): ReminderItem[] {
  return comps
    .flatMap((comp) => remindersForComp(comp, prefs, scope, now))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "newly-announced" ? -1 : 1;
      if (a.kind === "newly-announced") return b.fireAt.localeCompare(a.fireAt);
      return a.fireAt.localeCompare(b.fireAt);
    });
}

/** In-app list: recent announcements and upcoming or just-opened entries. */
export function inAppReminders(
  items: ReminderItem[],
  now = new Date(),
): ReminderItem[] {
  const horizon = addDays(now, UPCOMING_HORIZON_DAYS).getTime();
  return items.filter((item) => {
    const t = new Date(item.fireAt).getTime();
    if (Number.isNaN(t) || t > horizon) return false;
    const lookback =
      item.kind === "newly-announced"
        ? NEWLY_ANNOUNCED_LOOKBACK_DAYS
        : OPEN_LOOKBACK_DAYS;
    return t >= addDays(now, -lookback).getTime();
  });
}

export function upcomingReminders(
  items: ReminderItem[],
  now = new Date(),
  horizonDays = UPCOMING_HORIZON_DAYS,
): ReminderItem[] {
  const horizon = addDays(now, horizonDays).getTime();
  return items.filter((item) => {
    const t = new Date(item.fireAt).getTime();
    return t >= now.getTime() - 12 * 60 * 60 * 1000 && t <= horizon;
  });
}

export function dueReminders(
  items: ReminderItem[],
  notifiedIds: string[],
  now = new Date(),
): ReminderItem[] {
  const seen = new Set(notifiedIds);
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    const fire = new Date(item.fireAt).getTime();
    return fire <= now.getTime() && fire >= now.getTime() - 36 * 60 * 60 * 1000;
  });
}
