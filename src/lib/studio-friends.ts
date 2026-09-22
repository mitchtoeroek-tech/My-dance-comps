import { getSupabase } from "./supabase";

export type StudioFriendViewerRole = "parent" | "dancer" | "studio" | "none";

export interface StudioFriendPerson {
  userId: string;
  label: string;
  friendshipId: string | null;
  /** Dancer login in the same family. Still a same-studio friend on this list. */
  sibling?: boolean;
}

export interface StudioFriendDirectory {
  studioName: string;
  viewerRole: StudioFriendViewerRole;
  canAdd: boolean;
  suggest: StudioFriendPerson[];
  incoming: StudioFriendPerson[];
  outgoing: StudioFriendPerson[];
  friends: StudioFriendPerson[];
}

export interface StudioFriendThread {
  friendshipId: string;
  studioId: string;
  studioName: string;
  label: string;
}

export interface StudioFriendInbox {
  incomingCount: number;
  threads: StudioFriendThread[];
}

export interface StudioFriendActionResult {
  ok: boolean;
  error?: string;
}

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcError = { message?: string; code?: string } | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

export function isStudioFriendUserId(value: string): boolean {
  return USER_ID_RE.test(value.trim());
}

/** Hide anything that looks like an email. The database sets the real label. */
export function safeFriendLabel(label: string | null | undefined, fallback: string): string {
  const trimmed = (label ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.includes("@")) return fallback;
  return trimmed.slice(0, 160);
}

export function parseViewerRole(value: unknown): StudioFriendViewerRole {
  if (value === "parent" || value === "dancer" || value === "studio") return value;
  return "none";
}

export function friendLabelFallback(role: StudioFriendViewerRole): string {
  if (role === "parent") return "Parent";
  if (role === "dancer") return "Dancer";
  return "Member";
}

export function emptyStudioFriendDirectory(): StudioFriendDirectory {
  return {
    studioName: "Studio",
    viewerRole: "none",
    canAdd: false,
    suggest: [],
    incoming: [],
    outgoing: [],
    friends: [],
  };
}

export function emptyStudioFriendInbox(): StudioFriendInbox {
  return { incomingCount: 0, threads: [] };
}

function parsePerson(
  raw: unknown,
  role: StudioFriendViewerRole,
  requireFriendship: boolean,
): StudioFriendPerson | null {
  const row = asRecord(raw);
  if (!row) return null;
  const userId = asString(row.user_id ?? row.userId).trim();
  if (!isStudioFriendUserId(userId)) return null;
  const friendshipId = asString(row.friendship_id ?? row.friendshipId).trim();
  const hasFriendship = isStudioFriendUserId(friendshipId);
  if (requireFriendship && !hasFriendship) return null;
  return {
    userId,
    label: safeFriendLabel(asString(row.label), friendLabelFallback(role)),
    friendshipId: hasFriendship ? friendshipId : null,
    sibling: asBoolean(row.sibling, false) || undefined,
  };
}

function parsePeople(
  raw: unknown,
  role: StudioFriendViewerRole,
  requireFriendship: boolean,
): StudioFriendPerson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const people: StudioFriendPerson[] = [];
  for (const item of raw) {
    const person = parsePerson(item, role, requireFriendship);
    if (!person || seen.has(person.userId)) continue;
    seen.add(person.userId);
    people.push(person);
  }
  return people;
}

export function parseStudioFriendDirectory(raw: unknown): StudioFriendDirectory {
  const row = asRecord(raw) ?? {};
  const viewerRole = parseViewerRole(row.viewer_role ?? row.viewerRole);
  const studioName = safeFriendLabel(
    asString(row.studio_name ?? row.studioName),
    "Studio",
  );
  const canAdd =
    asBoolean(row.can_add ?? row.canAdd, false) &&
    (viewerRole === "parent" || viewerRole === "dancer");
  return {
    studioName,
    viewerRole,
    canAdd,
    suggest: canAdd ? parsePeople(row.suggest, viewerRole, false) : [],
    incoming: canAdd ? parsePeople(row.incoming, viewerRole, true) : [],
    outgoing: canAdd ? parsePeople(row.outgoing, viewerRole, true) : [],
    friends: canAdd ? parsePeople(row.friends, viewerRole, true) : [],
  };
}

export function directoryHasPrivateFields(raw: unknown): boolean {
  const text = JSON.stringify(raw ?? {});
  return /"email"|"dob"|"phone"|"user_email"/i.test(text) || text.includes("@");
}

export function studioFriendIntro(
  role: StudioFriendViewerRole,
  studioName: string,
): string {
  const studio = studioName.trim() || "this studio";
  if (role === "dancer") {
    return `Add other dancers at ${studio}. A brother or sister in your family can also be added from My Info, even at another studio. You will see first names, not email addresses.`;
  }
  if (role === "parent") {
    return `Add other parents at ${studio}. You will see their name with their dancers, for example Sarah, parent of Evie, not an email address.`;
  }
  return `Friend linking at ${studio} is for parent and dancer logins.`;
}

export function parseStudioFriendInbox(raw: unknown): StudioFriendInbox {
  const row = asRecord(raw) ?? {};
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(row.threads)
      ? row.threads
      : [];
  const threads: StudioFriendThread[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const friendshipId = asString(rec.friendship_id ?? rec.friendshipId).trim();
    const studioId = asString(rec.studio_id ?? rec.studioId).trim();
    if (!isStudioFriendUserId(friendshipId) || !isStudioFriendUserId(studioId)) continue;
    if (seen.has(friendshipId)) continue;
    seen.add(friendshipId);
    threads.push({
      friendshipId,
      studioId,
      studioName: safeFriendLabel(asString(rec.studio_name ?? rec.studioName), "Studio"),
      label: safeFriendLabel(asString(rec.label), "Friend"),
    });
  }
  return {
    incomingCount: asCount(row.incoming_count ?? row.incomingCount),
    threads,
  };
}

export function friendlyStudioFriendsError(
  error: RpcError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  ) {
    return "Studio friends are not set up on this project yet. Run the studio friends SQL in Supabase, then try again.";
  }
  if (lower.includes("not authenticated")) {
    return "Sign in to add friends at your studio.";
  }
  if (lower.includes("not open to you")) {
    return "This studio chat is not open to you.";
  }
  if (lower.includes("studio accounts are not on the friend list")) {
    return "Studio accounts are not on the friend list. Use a parent or dancer login.";
  }
  if (lower.includes("parents can only add other parents")) {
    return "Parents can only add other parents at this studio.";
  }
  if (lower.includes("dancers can only add other dancers")) {
    return "Dancers can only add other dancers at this studio.";
  }
  if (lower.includes("parents and dancers cannot be friends")) {
    return "Parents and dancers cannot be friends.";
  }
  if (lower.includes("only add people at this studio") || lower.includes("same studio")) {
    return "You can only add people at this studio.";
  }
  if (lower.includes("already friends")) {
    return "You are already friends at this studio.";
  }
  if (lower.includes("already sent you a request")) {
    return "They already sent you a request — accept it here.";
  }
  if (lower.includes("already waiting")) {
    return "That friend request is already waiting.";
  }
  if (lower.includes("no longer waiting")) {
    return "That request is no longer waiting.";
  }
  if (lower.includes("not your request")) {
    return "Only the other person can accept or decline that request.";
  }
  if (lower.includes("not your friend")) {
    return "Only the two of you can remove that friend.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^error:\s*/i, "");
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { data: null, error: "Accounts are not connected in this environment yet." };
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { data: null, error: friendlyStudioFriendsError(error) };
  return { data: (data as T) ?? null, error: null };
}

export async function loadStudioFriends(
  studioId: string,
): Promise<{ directory: StudioFriendDirectory | null; error: string | null }> {
  if (!isStudioFriendUserId(studioId)) {
    return { directory: null, error: "That studio chat link is not valid." };
  }
  const { data, error } = await rpc<unknown>("list_studio_friends", {
    p_studio_id: studioId,
  });
  if (error) return { directory: null, error };
  return { directory: parseStudioFriendDirectory(data), error: null };
}

export async function loadMyStudioFriendThreads(): Promise<{
  inbox: StudioFriendInbox | null;
  error: string | null;
}> {
  const { data, error } = await rpc<unknown>("list_my_studio_friend_threads", {});
  if (error) return { inbox: null, error };
  return { inbox: parseStudioFriendInbox(data), error: null };
}

export async function requestStudioFriend(
  studioId: string,
  otherUserId: string,
): Promise<StudioFriendActionResult> {
  if (!isStudioFriendUserId(studioId) || !isStudioFriendUserId(otherUserId)) {
    return { ok: false, error: "That friend link is not valid." };
  }
  const { error } = await rpc<unknown>("request_studio_friend", {
    p_studio_id: studioId,
    p_other_user_id: otherUserId,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}

export async function respondStudioFriend(
  friendshipId: string,
  accept: boolean,
): Promise<StudioFriendActionResult> {
  if (!isStudioFriendUserId(friendshipId)) {
    return { ok: false, error: "That friend request is not valid." };
  }
  const { error } = await rpc<unknown>("respond_studio_friend", {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}

export async function removeStudioFriend(
  friendshipId: string,
): Promise<StudioFriendActionResult> {
  if (!isStudioFriendUserId(friendshipId)) {
    return { ok: false, error: "That friend link is not valid." };
  }
  const { error } = await rpc<unknown>("remove_studio_friend", {
    p_friendship_id: friendshipId,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}
