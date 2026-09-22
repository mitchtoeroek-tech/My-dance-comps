/**
 * Last-seen watermarks for the bottom-nav dots.
 *
 * The first time Community or Reminders data is known on this device, that
 * snapshot is marked seen. A dot appears only when a later studio/friend
 * message, or a new in-app reminder id, arrives after that mark. Opening
 * `/community` (including a thread) or `/reminders` moves the mark forward.
 *
 * Stored on this device only. Family sync already covers reminder prefs, not
 * per-device "I looked at the tab" state.
 */

export const NAV_BADGE_STORAGE_KEY = "mydancecomps.navBadges.v1";
export const GUEST_NAV_BADGE_OWNER = "guest";

const OWNER_RE = /^[A-Za-z0-9_-]{1,80}$/;
const SEEN_ID_CAP = 400;
const OWNER_CAP = 12;

export interface NavBadgeScope {
  communityBaselined: boolean;
  lastSeenCommunityAt: string | null;
  remindersBaselined: boolean;
  seenReminderIds: readonly string[];
}

export const EMPTY_NAV_BADGE_SCOPE: NavBadgeScope = Object.freeze({
  communityBaselined: false,
  lastSeenCommunityAt: null,
  remindersBaselined: false,
  seenReminderIds: Object.freeze([]),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNavBadgeOwnerId(value: string): boolean {
  return OWNER_RE.test(value);
}

export function navBadgeOwnerId(userId: string | null | undefined): string {
  const trimmed = userId?.trim() ?? "";
  return isNavBadgeOwnerId(trimmed) ? trimmed : GUEST_NAV_BADGE_OWNER;
}

export function activityTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** Latest valid timestamp. Equal instants keep the earlier candidate. */
export function latestActivityAt(
  stamps: Array<string | null | undefined>,
): string | null {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const stamp of stamps) {
    const time = activityTime(stamp);
    if (time === null) continue;
    if (best === null || time > bestTime) {
      best = stamp ?? null;
      bestTime = time;
    }
  }
  return best;
}

export function isIsoAfter(later: string, earlier: string): boolean {
  const left = activityTime(later);
  const right = activityTime(earlier);
  if (left === null || right === null) return false;
  return left > right;
}

export function communityHasUnread(
  latestAt: string | null,
  scope: NavBadgeScope,
): boolean {
  if (!scope.communityBaselined || !latestAt || !scope.lastSeenCommunityAt) {
    return false;
  }
  return isIsoAfter(latestAt, scope.lastSeenCommunityAt);
}

export function remindersHaveUnread(
  ids: readonly string[],
  scope: NavBadgeScope,
): boolean {
  if (!scope.remindersBaselined) return false;
  const seen = new Set(scope.seenReminderIds);
  return ids.some((id) => {
    const trimmed = id.trim();
    return Boolean(trimmed) && !seen.has(trimmed);
  });
}

export function withCommunitySeen(
  scope: NavBadgeScope,
  latestAt: string | null,
  nowIso: string,
): NavBadgeScope {
  const lastSeenCommunityAt = latestActivityAt([
    scope.lastSeenCommunityAt,
    latestAt,
    nowIso,
  ]);
  if (
    scope.communityBaselined &&
    scope.lastSeenCommunityAt === lastSeenCommunityAt
  ) {
    return scope;
  }
  return {
    ...scope,
    communityBaselined: true,
    lastSeenCommunityAt,
  };
}

export function mergeSeenIds(
  previous: readonly string[],
  current: readonly string[],
): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const id of [...current, ...previous]) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
    if (next.length >= SEEN_ID_CAP) break;
  }
  return next;
}

export function withRemindersSeen(
  scope: NavBadgeScope,
  ids: readonly string[],
): NavBadgeScope {
  const missing = ids.some((id) => {
    const trimmed = id.trim();
    return Boolean(trimmed) && !scope.seenReminderIds.includes(trimmed);
  });
  if (scope.remindersBaselined && !missing) return scope;
  return {
    ...scope,
    remindersBaselined: true,
    seenReminderIds: mergeSeenIds(scope.seenReminderIds, ids),
  };
}

function normalizeScope(raw: unknown): NavBadgeScope {
  if (!isRecord(raw)) {
    return {
      communityBaselined: false,
      lastSeenCommunityAt: null,
      remindersBaselined: false,
      seenReminderIds: [],
    };
  }
  const lastRaw =
    typeof raw.lastSeenCommunityAt === "string" ? raw.lastSeenCommunityAt : null;
  const lastSeenCommunityAt =
    activityTime(lastRaw) === null ? null : lastRaw;
  const seenReminderIds = mergeSeenIds(
    [],
    Array.isArray(raw.seenReminderIds)
      ? raw.seenReminderIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  return {
    communityBaselined: raw.communityBaselined === true && lastSeenCommunityAt !== null,
    lastSeenCommunityAt,
    remindersBaselined: raw.remindersBaselined === true,
    seenReminderIds,
  };
}

export function parseNavBadgeStore(raw: unknown): Record<string, NavBadgeScope> {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.owners)) return {};
  const owners: Record<string, NavBadgeScope> = {};
  for (const [key, value] of Object.entries(raw.owners)) {
    if (!isNavBadgeOwnerId(key)) continue;
    owners[key] = normalizeScope(value);
  }
  return owners;
}

function scopesEqual(a: NavBadgeScope, b: NavBadgeScope): boolean {
  if (a.communityBaselined !== b.communityBaselined) return false;
  if (a.remindersBaselined !== b.remindersBaselined) return false;
  if (a.lastSeenCommunityAt !== b.lastSeenCommunityAt) return false;
  if (a.seenReminderIds.length !== b.seenReminderIds.length) return false;
  return a.seenReminderIds.every((id, index) => id === b.seenReminderIds[index]);
}

function trimOwners(
  owners: Record<string, NavBadgeScope>,
  keepId: string,
): Record<string, NavBadgeScope> {
  const keys = Object.keys(owners);
  if (keys.length <= OWNER_CAP) return owners;
  const next: Record<string, NavBadgeScope> = {};
  if (owners[keepId]) next[keepId] = owners[keepId];
  for (const key of keys) {
    if (Object.keys(next).length >= OWNER_CAP) break;
    if (key === keepId) continue;
    next[key] = owners[key];
  }
  return next;
}

let memory: Record<string, NavBadgeScope> | null = null;
const listeners = new Set<() => void>();

function readStore(): Record<string, NavBadgeScope> {
  if (memory) return memory;
  memory = {};
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(NAV_BADGE_STORAGE_KEY);
    if (!raw) return memory;
    memory = parseNavBadgeStore(JSON.parse(raw));
  } catch {
    memory = {};
  }
  return memory;
}

export function getNavBadgeScope(ownerId: string): NavBadgeScope {
  const id = navBadgeOwnerId(ownerId);
  return readStore()[id] ?? EMPTY_NAV_BADGE_SCOPE;
}

export function getServerNavBadgeScope(): NavBadgeScope {
  return EMPTY_NAV_BADGE_SCOPE;
}

export function subscribeNavBadges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishNavBadgeScope(ownerId: string, scope: NavBadgeScope) {
  const id = navBadgeOwnerId(ownerId);
  const store = readStore();
  const prev = store[id] ?? EMPTY_NAV_BADGE_SCOPE;
  if (prev === scope || scopesEqual(prev, scope)) return;
  const next = trimOwners({ ...store, [id]: scope }, id);
  memory = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        NAV_BADGE_STORAGE_KEY,
        JSON.stringify({ version: 1, owners: next }),
      );
    } catch {
      /* private mode / quota */
    }
  }
  listeners.forEach((listener) => listener());
}
