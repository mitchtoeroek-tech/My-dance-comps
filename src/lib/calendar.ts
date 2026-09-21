import { registrationStatus } from "./comps";
import { ADELAIDE_TZ } from "./datetime";
import { filterComps } from "./filter";
import type { CompFilters } from "./filter";
import type { Competition, RegistrationStatus } from "./types";

export type CalendarMonth = { year: number; month: number };

export type CalendarCell = {
  iso: string;
  inMonth: boolean;
};

export type DayMarks = {
  iso: string;
  total: number;
  enrolled: boolean;
  enrolledCount: number;
  /** Unique statuses on this day, urgent first — used as coloured dots. */
  statuses: RegistrationStatus[];
};

/** Closing soon first, then open, opening, closed, dates TBC. */
export const STATUS_PRIORITY: RegistrationStatus[] = [
  "closing-soon",
  "open",
  "opens-soon",
  "closed",
  "unknown",
];

export const STATUS_DOT_CLASS: Record<RegistrationStatus, string> = {
  open: "bg-status-open",
  "opens-soon": "bg-status-opening",
  "closing-soon": "bg-status-closing",
  closed: "bg-status-closed",
  unknown: "bg-status-unknown",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(
  iso: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (typeof iso !== "string") return null;
  const match = ISO_DATE.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function adelaideTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ADELAIDE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function monthFromIso(iso: string): CalendarMonth {
  const parsed = parseIsoDate(iso) ?? parseIsoDate(adelaideTodayIso())!;
  return { year: parsed.year, month: parsed.month };
}

export function shiftMonth(
  month: CalendarMonth,
  delta: number,
): CalendarMonth {
  const date = new Date(Date.UTC(month.year, month.month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function addDaysIso(
  iso: string,
  days: number,
): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** Inclusive calendar-date span for a competition (Adelaide date strings). */
export function eachDateInRange(
  start: string | null | undefined,
  end?: string | null | undefined,
): string[] {
  const startParsed = parseIsoDate(start);
  if (!startParsed) return [];
  const startIso = formatIsoDate(
    startParsed.year,
    startParsed.month,
    startParsed.day,
  );
  const endParsed = parseIsoDate(end) ?? startParsed;
  const endIso = formatIsoDate(endParsed.year, endParsed.month, endParsed.day);
  const from = startIso <= endIso ? startIso : endIso;
  const to = startIso <= endIso ? endIso : startIso;
  const days: string[] = [];
  let cursor: string | null = from;
  for (let i = 0; i < 400 && cursor && cursor <= to; i++) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

/** Monday-first 6-week grid for a calendar month. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = formatIsoDate(year, month, 1);
  const sundayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (sundayIndex + 6) % 7;
  const start = addDaysIso(first, -mondayOffset);
  if (!start) return [];
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDaysIso(start, i);
    if (!iso) break;
    const parsed = parseIsoDate(iso);
    cells.push({
      iso,
      inMonth: Boolean(parsed && parsed.year === year && parsed.month === month),
    });
  }
  return cells;
}

export function formatMonthTitle(month: CalendarMonth): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
}

export function formatDayHeading(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

/**
 * Comps to plot on the month view — same state / interstate / child
 * rules as the Comps list. Favourites and enrolled comps only appear
 * when they also match that location filter (enrolled still gets a star).
 */
export function selectCalendarComps(
  comps: Competition[],
  options: {
    filters: CompFilters;
  },
): Competition[] {
  return filterComps(comps, {
    ...options.filters,
    query: options.filters.query ?? "",
  }).filter((comp) => Boolean(comp.startDate));
}

export function compsOnDate(
  comps: Competition[],
  iso: string,
): Competition[] {
  return comps.filter((comp) =>
    eachDateInRange(comp.startDate, comp.endDate || comp.startDate).includes(
      iso,
    ),
  );
}

export function marksForDay(
  comps: Competition[],
  iso: string,
  enrolledIds: string[],
  now = new Date(),
): DayMarks {
  const onDay = compsOnDate(comps, iso);
  const enrolledSet = new Set(enrolledIds);
  const seen = new Set<RegistrationStatus>();
  let enrolledCount = 0;
  for (const comp of onDay) {
    if (enrolledSet.has(comp.id)) enrolledCount += 1;
    seen.add(registrationStatus(comp, now));
  }
  return {
    iso,
    total: onDay.length,
    enrolled: enrolledCount > 0,
    enrolledCount,
    statuses: STATUS_PRIORITY.filter((status) => seen.has(status)),
  };
}

export function sortDayComps(
  comps: Competition[],
  enrolledIds: string[],
  now = new Date(),
): Competition[] {
  const enrolledSet = new Set(enrolledIds);
  return [...comps].sort((a, b) => {
    const aEnrolled = enrolledSet.has(a.id) ? 0 : 1;
    const bEnrolled = enrolledSet.has(b.id) ? 0 : 1;
    if (aEnrolled !== bEnrolled) return aEnrolled - bEnrolled;
    const aStatus = STATUS_PRIORITY.indexOf(registrationStatus(a, now));
    const bStatus = STATUS_PRIORITY.indexOf(registrationStatus(b, now));
    if (aStatus !== bStatus) return aStatus - bStatus;
    return a.name.localeCompare(b.name);
  });
}
