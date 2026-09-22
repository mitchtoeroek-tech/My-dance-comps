import { registrationStatus } from "./comps";
import { addDays } from "./datetime";
import type { Competition, RegistrationStatus } from "./types";

export const REMINDER_WATCH_KEY = "mydancecomps.reminderWatch.v1";

const STAMP_KEEP_DAYS = 45;

/**
 * Device-local watermark of comps already seen in the listings.
 * The first trusted catalogue is recorded without raising “newly announced”
 * reminders. Comps that appear after that watermark can.
 *
 * A seed-only baseline is provisional. The next successful live catalogue
 * replaces it, so comps that were already on the server are not announced
 * just because they were missing from the bundled file.
 */
export interface ReminderWatch {
  baselinedAt: string | null;
  provisional: boolean;
  seenIds: string[];
  announcedAt: Record<string, string>;
  statusById: Record<string, RegistrationStatus>;
  openedAt: Record<string, string>;
}

export function emptyReminderWatch(): ReminderWatch {
  return {
    baselinedAt: null,
    provisional: false,
    seenIds: [],
    announcedAt: {},
    statusById: {},
    openedAt: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStampMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const next: Record<string, string> = {};
  for (const [key, stamp] of Object.entries(value)) {
    if (typeof stamp === "string" && stamp) next[key] = stamp;
  }
  return next;
}

const STATUSES = new Set<RegistrationStatus>([
  "opens-soon",
  "open",
  "closing-soon",
  "closed",
  "unknown",
]);

function asStatusMap(value: unknown): Record<string, RegistrationStatus> {
  if (!isRecord(value)) return {};
  const next: Record<string, RegistrationStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (typeof status === "string" && STATUSES.has(status as RegistrationStatus)) {
      next[key] = status as RegistrationStatus;
    }
  }
  return next;
}

export function normalizeReminderWatch(raw: unknown): ReminderWatch {
  if (!isRecord(raw)) return emptyReminderWatch();
  const baselinedAt =
    typeof raw.baselinedAt === "string" && raw.baselinedAt ? raw.baselinedAt : null;
  const seenIds = Array.isArray(raw.seenIds)
    ? [...new Set(raw.seenIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
    : [];
  return {
    baselinedAt,
    provisional: raw.provisional === true,
    seenIds,
    announcedAt: asStampMap(raw.announcedAt),
    statusById: asStatusMap(raw.statusById),
    openedAt: asStampMap(raw.openedAt),
  };
}

function pruneStamps(
  map: Record<string, string>,
  now: Date,
  days: number,
): Record<string, string> {
  const cutoff = addDays(now, -days).toISOString();
  const next: Record<string, string> = {};
  for (const [id, stamp] of Object.entries(map)) {
    if (stamp >= cutoff) next[id] = stamp;
  }
  return next;
}

function baselineWatch(
  comps: Competition[],
  now: Date,
  provisional: boolean,
): ReminderWatch {
  const seenIds: string[] = [];
  const statusById: Record<string, RegistrationStatus> = {};
  for (const comp of comps) {
    if (!comp?.id || statusById[comp.id]) continue;
    seenIds.push(comp.id);
    statusById[comp.id] = registrationStatus(comp, now);
  }
  return {
    baselinedAt: now.toISOString(),
    provisional,
    seenIds,
    announcedAt: {},
    statusById,
    openedAt: {},
  };
}

function isOpenStatus(status: RegistrationStatus | undefined): boolean {
  return status === "open" || status === "closing-soon";
}

/**
 * Fold the current catalogue into the watermark.
 * `source` is `"live"` after a successful listings response, otherwise `"seed"`.
 */
export function absorbCompCatalogue(
  prev: ReminderWatch,
  comps: Competition[],
  now = new Date(),
  source: "live" | "seed" = "live",
): ReminderWatch {
  const current = normalizeReminderWatch(prev);
  if (!current.baselinedAt || (current.provisional && source === "live")) {
    return baselineWatch(comps, now, source !== "live");
  }

  const stamp = now.toISOString();
  const seen = new Set(current.seenIds);
  const announcedAt = { ...current.announcedAt };
  const openedAt = { ...current.openedAt };
  const statusById = { ...current.statusById };

  for (const comp of comps) {
    if (!comp?.id) continue;
    if (!seen.has(comp.id)) {
      seen.add(comp.id);
      if (!announcedAt[comp.id]) announcedAt[comp.id] = stamp;
    }
    const status = registrationStatus(comp, now);
    const previous = statusById[comp.id];
    if (
      !comp.registrationOpens &&
      isOpenStatus(status) &&
      previous &&
      !isOpenStatus(previous) &&
      !openedAt[comp.id]
    ) {
      openedAt[comp.id] = stamp;
    }
    statusById[comp.id] = status;
  }

  return {
    baselinedAt: current.baselinedAt,
    provisional: current.provisional,
    seenIds: [...seen],
    announcedAt: pruneStamps(announcedAt, now, STAMP_KEEP_DAYS),
    statusById,
    openedAt: pruneStamps(openedAt, now, STAMP_KEEP_DAYS),
  };
}

export function loadReminderWatch(): ReminderWatch {
  if (typeof window === "undefined") return emptyReminderWatch();
  try {
    const raw = window.localStorage.getItem(REMINDER_WATCH_KEY);
    if (!raw) return emptyReminderWatch();
    return normalizeReminderWatch(JSON.parse(raw));
  } catch {
    return emptyReminderWatch();
  }
}

export function saveReminderWatch(watch: ReminderWatch) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REMINDER_WATCH_KEY,
      JSON.stringify(normalizeReminderWatch(watch)),
    );
  } catch {
    /* private mode / quota */
  }
}

const initialWatch = emptyReminderWatch();
let memory: ReminderWatch = initialWatch;
let ready = false;
const listeners = new Set<() => void>();

export function getServerReminderWatch(): ReminderWatch {
  return initialWatch;
}

export function subscribeReminderWatch(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReminderWatch(): ReminderWatch {
  return memory;
}

export function isReminderWatchReady(): boolean {
  return ready;
}

/** Record the current catalogue, then notify subscribers if the watermark changed. */
export function publishReminderCatalogue(
  comps: Competition[],
  source: "live" | "seed",
  now = new Date(),
) {
  const prev = loadReminderWatch();
  const next = absorbCompCatalogue(prev, comps, now, source);
  if (JSON.stringify(prev) !== JSON.stringify(next)) saveReminderWatch(next);
  const unchanged = ready && JSON.stringify(memory) === JSON.stringify(next);
  memory = next;
  ready = true;
  if (!unchanged) listeners.forEach((listener) => listener());
}
