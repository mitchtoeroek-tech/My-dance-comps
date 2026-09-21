export const ADELAIDE_TZ = "Australia/Adelaide";

function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function parseAdelaide(
  isoLocal: string | null | undefined,
): Date | null {
  if (typeof isoLocal !== "string" || !isoLocal.trim()) return null;
  try {
    let date: Date;
    if (/Z$|[+-]\d{2}:\d{2}$/.test(isoLocal)) {
      date = new Date(isoLocal);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(isoLocal)) {
      date = new Date(`${isoLocal}T00:00:00+09:30`);
    } else {
      const asIso = isoLocal.includes("T") ? isoLocal : `${isoLocal}T00:00:00`;
      const probe = new Date(`${asIso}+09:30`);
      const offset = adelaideOffset(probe);
      date = new Date(`${asIso}${offset}`);
    }
    return isValidDate(date) ? date : null;
  } catch {
    return null;
  }
}

export function adelaideOffset(date: Date): string {
  if (!isValidDate(date)) return "+09:30";
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: ADELAIDE_TZ,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+09:30";
    const match = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return "+09:30";
    const sign = match[1];
    const hours = match[2].padStart(2, "0");
    const mins = (match[3] ?? "00").padStart(2, "0");
    return `${sign}${hours}:${mins}`;
  } catch {
    return "+09:30";
  }
}

function formatSafe(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  fallback = "TBC",
): string {
  if (!isValidDate(date)) return fallback;
  try {
    return new Intl.DateTimeFormat("en-AU", options).format(date);
  } catch {
    return fallback;
  }
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const startDate = parseAdelaide(start);
  const endDate = parseAdelaide(end);
  if (!startDate && !endDate) return "Dates TBC";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: ADELAIDE_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (!startDate) return formatSafe(endDate!, opts);
  const startFmt = formatSafe(startDate, opts, start ?? "TBC");
  if (!endDate || start === end) return startFmt;
  const endFmt = formatSafe(endDate, opts, end ?? "TBC");
  return `${startFmt} – ${endFmt}`;
}

export function formatDateTime(isoLocal: string | null | undefined): string {
  if (!isoLocal) return "TBC";
  const date = parseAdelaide(isoLocal);
  if (!date) return "TBC";
  return formatSafe(date, {
    timeZone: ADELAIDE_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatShortDate(iso: string | null | undefined): string {
  const date = parseAdelaide(iso);
  if (!date) return iso?.trim() ? iso : "TBC";
  return formatSafe(
    date,
    {
      timeZone: ADELAIDE_TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
    },
    iso ?? "TBC",
  );
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setTime(next.getTime() + days * 24 * 60 * 60 * 1000);
  return next;
}

export function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function toIcsDay(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}
