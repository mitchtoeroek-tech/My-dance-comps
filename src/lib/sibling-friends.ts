import { getSupabase } from "./supabase";
import { isStudioFriendUserId, safeFriendLabel } from "./studio-friends";

export interface SiblingFriendPerson {
  userId: string;
  label: string;
  friendshipId: string | null;
}

export interface SiblingFriendDirectory {
  canAdd: boolean;
  suggest: SiblingFriendPerson[];
  incoming: SiblingFriendPerson[];
  outgoing: SiblingFriendPerson[];
  friends: SiblingFriendPerson[];
}

export interface SiblingFriendActionResult {
  ok: boolean;
  error?: string;
}

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

export function emptySiblingFriendDirectory(): SiblingFriendDirectory {
  return {
    canAdd: false,
    suggest: [],
    incoming: [],
    outgoing: [],
    friends: [],
  };
}

function parsePerson(raw: unknown, requireFriendship: boolean): SiblingFriendPerson | null {
  const row = asRecord(raw);
  if (!row) return null;
  const userId = asString(row.user_id ?? row.userId).trim();
  if (!isStudioFriendUserId(userId)) return null;
  const friendshipId = asString(row.friendship_id ?? row.friendshipId).trim();
  const hasFriendship = isStudioFriendUserId(friendshipId);
  if (requireFriendship && !hasFriendship) return null;
  return {
    userId,
    label: safeFriendLabel(asString(row.label), "Dancer"),
    friendshipId: hasFriendship ? friendshipId : null,
  };
}

function parsePeople(raw: unknown, requireFriendship: boolean): SiblingFriendPerson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const people: SiblingFriendPerson[] = [];
  for (const item of raw) {
    const person = parsePerson(item, requireFriendship);
    if (!person || seen.has(person.userId)) continue;
    seen.add(person.userId);
    people.push(person);
  }
  return people;
}

export function parseSiblingFriendDirectory(raw: unknown): SiblingFriendDirectory {
  const row = asRecord(raw) ?? {};
  const canAdd = asBoolean(row.can_add ?? row.canAdd, false);
  return {
    canAdd,
    suggest: canAdd ? parsePeople(row.suggest, false) : [],
    incoming: canAdd ? parsePeople(row.incoming, true) : [],
    outgoing: canAdd ? parsePeople(row.outgoing, true) : [],
    friends: canAdd ? parsePeople(row.friends, true) : [],
  };
}

export function siblingDirectoryHasPrivateFields(raw: unknown): boolean {
  const text = JSON.stringify(raw ?? {});
  return /"email"|"dob"|"phone"|"user_email"/i.test(text) || text.includes("@");
}

export function friendlySiblingFriendsError(
  error: RpcError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  ) {
    return "Sibling friends are not set up on this project yet. Run the sibling friends SQL in Supabase, then try again.";
  }
  if (lower.includes("not authenticated")) {
    return "Sign in to add a sibling.";
  }
  if (lower.includes("parents and dancers cannot be friends")) {
    return "Parents and dancers cannot be friends.";
  }
  if (lower.includes("siblings must both be dancer")) {
    return "Siblings must both be dancer logins in this family.";
  }
  if (lower.includes("only add a sibling in your family") || lower.includes("join your family")) {
    return "You can only add a sibling who has their own dancer login in your family.";
  }
  if (lower.includes("already friends")) {
    return "You are already friends.";
  }
  if (lower.includes("already sent you a request")) {
    return "They already sent you a request — accept it here.";
  }
  if (lower.includes("already waiting") || lower.includes("request already waiting")) {
    return "That friend request is already waiting.";
  }
  if (lower.includes("that is you")) {
    return "That is your own login.";
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
  if (error) return { data: null, error: friendlySiblingFriendsError(error) };
  return { data: (data as T) ?? null, error: null };
}

export async function loadFamilySiblings(): Promise<{
  directory: SiblingFriendDirectory | null;
  error: string | null;
}> {
  const { data, error } = await rpc<unknown>("list_family_siblings", {});
  if (error) return { directory: null, error };
  return { directory: parseSiblingFriendDirectory(data), error: null };
}

export async function requestSiblingFriend(
  otherUserId: string,
): Promise<SiblingFriendActionResult> {
  if (!isStudioFriendUserId(otherUserId)) {
    return { ok: false, error: "That sibling link is not valid." };
  }
  const { error } = await rpc<unknown>("request_sibling_friend", {
    p_other_user_id: otherUserId,
  });
  if (error) return { ok: false, error };
  return { ok: true };
}
