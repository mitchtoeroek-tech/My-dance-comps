import { addDays, parseAdelaide } from "./datetime";
import type {
  Competition,
  ReminderItem,
  ReminderKind,
  ReminderPrefs,
} from "./types";

function kindLabel(kind: ReminderKind, name: string): string {
  switch (kind) {
    case "open":
      return `Entries open — ${name}`;
    case "week-before-close":
      return `One week to enter — ${name}`;
    case "day-before-close":
      return `Entries close tomorrow — ${name}`;
  }
}

function kindDetail(kind: ReminderKind, comp: Competition): string {
  switch (kind) {
    case "open":
      return `Registration opens for ${comp.name}. Head to the organiser site to enter.`;
    case "week-before-close":
      return `Entries for ${comp.name} close in about a week. Double-check sections and music.`;
    case "day-before-close":
      return `Last chance — ${comp.name} entries close tomorrow (Adelaide time).`;
  }
}

export function remindersForComp(
  comp: Competition,
  prefs: ReminderPrefs,
): ReminderItem[] {
  const items: ReminderItem[] = [];
  if (prefs.onOpen && comp.registrationOpens) {
    const fireAt = parseAdelaide(comp.registrationOpens);
    items.push({
      id: `${comp.id}:open`,
      kind: "open",
      compId: comp.id,
      compName: comp.name,
      fireAt: fireAt.toISOString(),
      label: kindLabel("open", comp.name),
      detail: kindDetail("open", comp),
    });
  }
  if (comp.registrationCloses) {
    const close = parseAdelaide(comp.registrationCloses);
    if (prefs.weekBeforeClose) {
      const fireAt = addDays(close, -7);
      items.push({
        id: `${comp.id}:week-before-close`,
        kind: "week-before-close",
        compId: comp.id,
        compName: comp.name,
        fireAt: fireAt.toISOString(),
        label: kindLabel("week-before-close", comp.name),
        detail: kindDetail("week-before-close", comp),
      });
    }
    if (prefs.dayBeforeClose) {
      const fireAt = addDays(close, -1);
      items.push({
        id: `${comp.id}:day-before-close`,
        kind: "day-before-close",
        compId: comp.id,
        compName: comp.name,
        fireAt: fireAt.toISOString(),
        label: kindLabel("day-before-close", comp.name),
        detail: kindDetail("day-before-close", comp),
      });
    }
  }
  return items;
}

export function buildReminders(
  comps: Competition[],
  prefs: ReminderPrefs,
  favouriteIds: string[],
): ReminderItem[] {
  const saved = comps.filter((c) => favouriteIds.includes(c.id));
  return saved
    .flatMap((comp) => remindersForComp(comp, prefs))
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

export function upcomingReminders(
  items: ReminderItem[],
  now = new Date(),
  horizonDays = 120,
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
  return items.filter((item) => {
    if (notifiedIds.includes(item.id)) return false;
    const fire = new Date(item.fireAt).getTime();
    return fire <= now.getTime() && fire >= now.getTime() - 36 * 60 * 60 * 1000;
  });
}
