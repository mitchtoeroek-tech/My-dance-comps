import compsJson from "@/data/comps.json";
import sourcesJson from "@/data/sources.json";
import { parseAdelaide } from "./datetime";
import type { CompSource, Competition, RegistrationStatus } from "./types";

export function getComps(): Competition[] {
  return compsJson as Competition[];
}

export function getComp(id: string): Competition | undefined {
  return getComps().find((c) => c.id === id);
}

export function getSources(): CompSource[] {
  return sourcesJson as CompSource[];
}

export function registrationStatus(
  comp: Competition,
  now = new Date(),
): RegistrationStatus {
  if (!comp.registrationOpens && !comp.registrationCloses) return "unknown";
  const opens = comp.registrationOpens
    ? parseAdelaide(comp.registrationOpens)
    : null;
  const closes = comp.registrationCloses
    ? parseAdelaide(comp.registrationCloses)
    : null;
  if (opens && now < opens) return "opens-soon";
  if (closes && now > closes) return "closed";
  if (opens && now >= opens && !closes) return "open";
  if (closes && now <= closes) {
    const week = 7 * 24 * 60 * 60 * 1000;
    if (closes.getTime() - now.getTime() <= week) return "closing-soon";
    return "open";
  }
  return "unknown";
}

export function statusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "opens-soon":
      return "Entries opening";
    case "open":
      return "Entries open";
    case "closing-soon":
      return "Closing soon";
    case "closed":
      return "Entries closed";
    default:
      return "Dates TBC";
  }
}

export function stateLabel(code: string): string {
  if (code === "NATIONAL") return "National";
  return code;
}
