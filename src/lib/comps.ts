import compsJson from "@/data/comps.json";
import sourcesJson from "@/data/sources.json";
import { parseAdelaide } from "./datetime";
import type {
  AuStateCode,
  CompKind,
  CompSource,
  Competition,
  DanceStyle,
  RegistrationStatus,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeCompetition(raw: unknown): Competition | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id).trim();
  const name = asString(raw.name).trim();
  const startDate = asString(raw.startDate).trim();
  if (!id || !name || !startDate) return null;
  const endDate = asString(raw.endDate).trim() || startDate;
  const styles = Array.isArray(raw.styles)
    ? raw.styles.filter((style): style is string => typeof style === "string")
    : [];
  return {
    id,
    name,
    kind: (asString(raw.kind, "competition") as CompKind) || "competition",
    organiser: asString(raw.organiser, "See source"),
    organiserUrl: asString(raw.organiserUrl),
    venue: asString(raw.venue, "TBC"),
    suburb: asString(raw.suburb, "TBC"),
    state: (asString(raw.state, "SA") as AuStateCode) || "SA",
    startDate,
    endDate,
    registrationOpens: asNullableString(raw.registrationOpens),
    registrationCloses: asNullableString(raw.registrationCloses),
    registrationUrl: asString(raw.registrationUrl),
    infoUrl: asString(raw.infoUrl),
    styles: styles as DanceStyle[],
    minAge: asNullableNumber(raw.minAge),
    maxAge: asNullableNumber(raw.maxAge),
    isNational: Boolean(raw.isNational),
    notes: asString(raw.notes),
    sourceId: asString(raw.sourceId),
    lastUpdated: asString(raw.lastUpdated),
    lastFetchedAt: asNullableString(raw.lastFetchedAt) ?? undefined,
  };
}

export function normalizeCompetitions(raw: unknown): Competition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeCompetition)
    .filter((comp): comp is Competition => comp !== null);
}

/** Keep seed rows (e.g. Full Out) when a live API payload is a stale subset. */
export function unionCompetitions(
  seed: Competition[],
  live: Competition[],
): Competition[] {
  const byId = new Map(seed.map((row) => [row.id, row]));
  for (const row of live) {
    const existing = byId.get(row.id);
    byId.set(row.id, existing ? { ...existing, ...row } : row);
  }
  return [...byId.values()];
}

export function getComps(): Competition[] {
  return normalizeCompetitions(compsJson);
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
  const opens = parseAdelaide(comp.registrationOpens);
  const closes = parseAdelaide(comp.registrationCloses);
  if (!opens && !closes) return "unknown";
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

export const STATUS_FILTER_OPTIONS: {
  value: RegistrationStatus;
  label: string;
}[] = [
  { value: "open", label: statusLabel("open") },
  { value: "closing-soon", label: statusLabel("closing-soon") },
  { value: "closed", label: statusLabel("closed") },
  { value: "opens-soon", label: statusLabel("opens-soon") },
  { value: "unknown", label: statusLabel("unknown") },
];

const STATUS_VALUES = new Set<RegistrationStatus>(
  STATUS_FILTER_OPTIONS.map((option) => option.value),
);

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && STATUS_VALUES.has(value as RegistrationStatus);
}

/** Venue name, suburb/city, and state — skips a suburb that duplicates the venue. */
export function formatCompLocation(
  comp: Pick<Competition, "venue" | "suburb" | "state">,
): string {
  const venue = comp.venue?.trim() ?? "";
  const suburb = comp.suburb?.trim() ?? "";
  const state = comp.state?.trim() ?? "";
  const parts: string[] = [];
  if (venue) parts.push(venue);
  if (suburb && suburb.toLowerCase() !== venue.toLowerCase()) {
    parts.push(suburb);
  }
  if (state) parts.push(state);
  return parts.join(", ");
}

export function stateLabel(code: string): string {
  if (code === "NATIONAL") return "National";
  return code;
}
