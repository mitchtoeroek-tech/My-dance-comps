export const ADELAIDE_TZ = "Australia/Adelaide";

export function parseAdelaide(isoLocal: string): Date {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(isoLocal)) {
    return new Date(isoLocal);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoLocal)) {
    return new Date(`${isoLocal}T00:00:00+09:30`);
  }
  const asIso = isoLocal.includes("T") ? isoLocal : `${isoLocal}T00:00:00`;
  const probe = new Date(`${asIso}+09:30`);
  const offset = adelaideOffset(probe);
  return new Date(`${asIso}${offset}`);
}

export function adelaideOffset(date: Date): string {
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
}

export function formatDateRange(start: string, end: string): string {
  const startDate = parseAdelaide(start);
  const endDate = parseAdelaide(end);
  const sameDay = start === end;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: ADELAIDE_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const startFmt = new Intl.DateTimeFormat("en-AU", opts).format(startDate);
  if (sameDay) return startFmt;
  const endFmt = new Intl.DateTimeFormat("en-AU", opts).format(endDate);
  return `${startFmt} – ${endFmt}`;
}

export function formatDateTime(isoLocal: string | null): string {
  if (!isoLocal) return "TBC";
  const date = parseAdelaide(isoLocal);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ADELAIDE_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: ADELAIDE_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseAdelaide(iso));
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
