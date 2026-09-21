import { formatCompLocation } from "./comps";
import { ADELAIDE_TZ, toIcsDay, toIcsUtc } from "./datetime";
import type { Competition, ReminderItem } from "./types";

function fold(line: string): string {
  return line.replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function eventBlock(opts: {
  uid: string;
  stamp: string;
  start: string;
  end?: string;
  allDay?: boolean;
  summary: string;
  description: string;
  url?: string;
  location?: string;
}): string {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${opts.stamp}`,
    opts.allDay
      ? `DTSTART;VALUE=DATE:${opts.start}`
      : `DTSTART:${opts.start}`,
  ];
  if (opts.end) {
    lines.push(
      opts.allDay ? `DTEND;VALUE=DATE:${opts.end}` : `DTEND:${opts.end}`,
    );
  }
  lines.push(`SUMMARY:${fold(opts.summary)}`);
  lines.push(`DESCRIPTION:${fold(opts.description)}`);
  if (opts.location) lines.push(`LOCATION:${fold(opts.location)}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function remindersToIcs(items: ReminderItem[]): string {
  const stamp = toIcsUtc(new Date());
  const events = items.map((item) =>
    eventBlock({
      uid: `${item.id}@mydancecomps.app`,
      stamp,
      start: toIcsUtc(new Date(item.fireAt)),
      summary: item.label,
      description: `${item.detail} Times are Australia/Adelaide.`,
    }),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Dance Comps//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${ADELAIDE_TZ}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function competitionToIcs(comp: Competition): string {
  const stamp = toIcsUtc(new Date());
  const startDate = comp.startDate || "19700101";
  const start = toIcsDay(startDate);
  const endSource = comp.endDate || comp.startDate || startDate;
  const endDate = new Date(`${endSource}T00:00:00Z`);
  if (!Number.isNaN(endDate.getTime())) {
    endDate.setUTCDate(endDate.getUTCDate() + 1);
  }
  const end = Number.isNaN(endDate.getTime())
    ? start
    : endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const event = eventBlock({
    uid: `${comp.id}@mydancecomps.app`,
    stamp,
    start,
    end,
    allDay: true,
    summary: comp.name,
    description: `${comp.organiser}. Entries: ${comp.registrationUrl}`,
    url: comp.infoUrl,
    location: formatCompLocation(comp),
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Dance Comps//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${ADELAIDE_TZ}`,
    event,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function mailtoReminders(items: ReminderItem[]): string {
  const subject = encodeURIComponent("Dance competition registration reminders");
  const body = encodeURIComponent(
    [
      "Here are the upcoming registration reminders from My Dance Comps.",
      "Times are Australia/Adelaide.",
      "",
      ...items.map((item) => {
        const when = new Date(item.fireAt).toLocaleString("en-AU", {
          timeZone: ADELAIDE_TZ,
          dateStyle: "full",
          timeStyle: "short",
        });
        return `• ${item.label}\n  ${when}\n  ${item.detail}`;
      }),
    ].join("\n"),
  );
  return `mailto:?subject=${subject}&body=${body}`;
}
