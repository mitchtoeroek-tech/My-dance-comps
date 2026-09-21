import { getSupabase } from "./supabase";
import { compareCompsByDate, type DateSortDir } from "./filter";
import type { Competition } from "./types";

export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LENGTH = 8;

export const GUEST_FRIENDS_TITLE = "Friends unlock when you sign in";
export const GUEST_FRIENDS_BODY =
  "Sign in so your dancer can add friends. You will see the comps a friend has marked as entered — not their favourites, and not their date of birth.";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "removed";

export interface FriendRef {
  friendshipId: string;
  childId: string;
  name: string;
}

export interface AcceptedFriend extends FriendRef {
  enrolledCompIds: string[];
}

export interface FriendsSnapshot {
  inviteCode: string;
  shareEnrolled: boolean;
  friends: AcceptedFriend[];
  incoming: FriendRef[];
  outgoing: FriendRef[];
}

export interface FriendLookup {
  childId: string;
  name: string;
}

export interface FriendActionResult {
  ok: boolean;
  status?: FriendshipStatus;
  friendshipId?: string;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Strip spaces and dashes, then uppercase — same as the SQL helper. */
export function normalizeFriendCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidFriendCode(code: string): boolean {
  const normalized = normalizeFriendCode(code);
  if (normalized.length !== FRIEND_CODE_LENGTH) return false;
  return [...normalized].every((ch) => FRIEND_CODE_ALPHABET.includes(ch));
}

export function displayFriendCode(code: string): string {
  const normalized = normalizeFriendCode(code);
  if (normalized.length === FRIEND_CODE_LENGTH) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  return normalized || code.trim().toUpperCase();
}

export function orderedChildPair(
  a: string,
  b: string,
): { low: string; high: string } | null {
  if (!a || !b || a === b) return null;
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export function friendInvitePath(code: string): string {
  return `/friends/join?code=${encodeURIComponent(displayFriendCode(code))}`;
}

export function friendInviteUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${friendInvitePath(code)}`;
}

export function friendInviteShareText(childName: string, code: string): string {
  const first = childName.trim() || "this dancer";
  return `Add ${first} as a dance friend on My Dance Comps. Invite code ${displayFriendCode(code)}.`;
}

export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export function resolveAuthNextPath(fallback = "/account"): string {
  if (typeof window === "undefined") return fallback;
  return (
    safeInternalPath(new URLSearchParams(window.location.search).get("next")) ??
    fallback
  );
}

export function loginPathWithNext(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export function signupPathWithNext(next: string): string {
  return `/signup?next=${encodeURIComponent(next)}`;
}

export function friendlyFriendsError(
  error: RpcError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist")
  ) {
    return "Friends is not set up on this project yet. Run the kids friends SQL in Supabase, then try again.";
  }
  if (lower.includes("not authenticated")) {
    return "Sign in to use Friends.";
  }
  if (lower.includes("not your dancer")) {
    return "Pick one of your dancers first.";
  }
  if (lower.includes("your own dancer")) {
    return "That invite belongs to this family.";
  }
  if (lower.includes("already in this family")) {
    return "That dancer is already in this family.";
  }
  if (lower.includes("could not find that dancer")) {
    return "We could not find that dancer. Check the spelling, or ask for their invite code.";
  }
  if (lower.includes("already friends")) {
    return "Those dancers are already friends.";
  }
  if (lower.includes("already sent you a request")) {
    return "They already sent you a request — accept it from Friends.";
  }
  if (lower.includes("already waiting")) {
    return "That friend request is already waiting.";
  }
  if (lower.includes("no longer waiting")) {
    return "That request is no longer waiting.";
  }
  if (lower.includes("not your request")) {
    return "Only the other parent can accept or decline that request.";
  }
  if (lower.includes("not your friend")) {
    return "Only this family or theirs can remove that friend.";
  }
  if (lower.includes("could not find that request") || lower.includes("could not find that friend")) {
    return "That friend request is no longer there.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^error:\s*/i, "");
}

function parseFriendRef(raw: unknown): FriendRef | null {
  const row = asRecord(raw);
  if (!row) return null;
  const friendshipId = asString(row.friendship_id || row.friendshipId).trim();
  const childId = asString(row.child_id || row.childId).trim();
  const name = asString(row.name).trim();
  if (!friendshipId || !childId || !name) return null;
  return { friendshipId, childId, name };
}

function parseAcceptedFriend(raw: unknown): AcceptedFriend | null {
  const base = parseFriendRef(raw);
  if (!base) return null;
  const row = asRecord(raw);
  const enrolledCompIds = asStringArray(
    row?.enrolled_comp_ids ?? row?.enrolledCompIds,
  );
  return { ...base, enrolledCompIds };
}

export function emptyFriendsSnapshot(): FriendsSnapshot {
  return {
    inviteCode: "",
    shareEnrolled: true,
    friends: [],
    incoming: [],
    outgoing: [],
  };
}

export function parseFriendsSnapshot(raw: unknown): FriendsSnapshot {
  const row = asRecord(raw) ?? {};
  const friends = Array.isArray(row.friends)
    ? row.friends.map(parseAcceptedFriend).filter((item): item is AcceptedFriend => Boolean(item))
    : [];
  const incoming = Array.isArray(row.incoming)
    ? row.incoming.map(parseFriendRef).filter((item): item is FriendRef => Boolean(item))
    : [];
  const outgoing = Array.isArray(row.outgoing)
    ? row.outgoing.map(parseFriendRef).filter((item): item is FriendRef => Boolean(item))
    : [];
  return {
    inviteCode: normalizeFriendCode(asString(row.invite_code || row.inviteCode)),
    shareEnrolled: asBoolean(row.share_enrolled ?? row.shareEnrolled, true),
    friends,
    incoming,
    outgoing,
  };
}

export function parseFriendLookups(raw: unknown): FriendLookup[] {
  const row = asRecord(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(row?.matches)
      ? row.matches
      : [];
  return list
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const childId = asString(rec.child_id || rec.childId).trim();
      const name = asString(rec.name).trim();
      if (!childId || !name) return null;
      if ("dob" in rec || "email" in rec || "user_id" in rec || "userId" in rec) {
        return { childId, name };
      }
      return { childId, name };
    })
    .filter((item): item is FriendLookup => Boolean(item));
}

export function snapshotHasPrivateFields(raw: unknown): boolean {
  const text = JSON.stringify(raw ?? {});
  return /"dob"|"email"|"favourites"|"user_id"|"userId"|"display_name"/i.test(text);
}

export function friendEnrolledComps(
  comps: Competition[],
  enrolledCompIds: string[],
  sortDir: DateSortDir = "asc",
): Competition[] {
  const allowed = new Set(enrolledCompIds);
  return comps
    .filter((comp) => allowed.has(comp.id))
    .slice()
    .sort((a, b) => compareCompsByDate(a, b, sortDir));
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
  if (error) return { data: null, error: friendlyFriendsError(error) };
  return { data: (data as T) ?? null, error: null };
}

export async function loadFriendsForChild(
  childId: string,
): Promise<{ snapshot: FriendsSnapshot | null; error: string | null }> {
  const { data, error } = await rpc<unknown>("list_friends_for_child", {
    p_child_id: childId,
  });
  if (error) return { snapshot: null, error };
  return { snapshot: parseFriendsSnapshot(data), error: null };
}

export async function lookupFriendByEmail(
  email: string,
  childName: string,
): Promise<{ matches: FriendLookup[]; error: string | null }> {
  const { data, error } = await rpc<unknown>("lookup_child_for_friend_request", {
    p_email: email.trim(),
    p_child_name: childName.trim(),
  });
  if (error) return { matches: [], error };
  return { matches: parseFriendLookups(data), error: null };
}

export async function lookupFriendByCode(
  code: string,
): Promise<{ matches: FriendLookup[]; error: string | null }> {
  const { data, error } = await rpc<unknown>("lookup_child_by_friend_code", {
    p_code: normalizeFriendCode(code),
  });
  if (error) return { matches: [], error };
  return { matches: parseFriendLookups(data), error: null };
}

export async function sendFriendRequest(
  fromChildId: string,
  toChildId: string,
): Promise<FriendActionResult> {
  const { data, error } = await rpc<unknown>("send_friend_request", {
    p_from_child_id: fromChildId,
    p_to_child_id: toChildId,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: asBoolean(row.ok, true),
    status: asString(row.status) as FriendshipStatus,
    friendshipId: asString(row.friendship_id || row.friendshipId) || undefined,
  };
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<FriendActionResult> {
  const { data, error } = await rpc<unknown>("respond_friend_request", {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: asBoolean(row.ok, true),
    status: asString(row.status) as FriendshipStatus,
    friendshipId: asString(row.friendship_id || row.friendshipId) || undefined,
  };
}

export async function removeFriendship(
  friendshipId: string,
): Promise<FriendActionResult> {
  const { data, error } = await rpc<unknown>("remove_friendship", {
    p_friendship_id: friendshipId,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: asBoolean(row.ok, true),
    status: "removed",
    friendshipId: asString(row.friendship_id || row.friendshipId) || undefined,
  };
}

export async function setShareEnrolled(
  childId: string,
  share: boolean,
): Promise<FriendActionResult> {
  const { data, error } = await rpc<unknown>("set_share_enrolled", {
    p_child_id: childId,
    p_share: share,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: asBoolean(row.ok, true) };
}

export async function shareFriendInvite(input: {
  childName: string;
  code: string;
  url: string;
}): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const text = `${friendInviteShareText(input.childName, input.code)} ${input.url}`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: "My Dance Comps friend invite",
        text: friendInviteShareText(input.childName, input.code),
        url: input.url,
      });
      return "shared";
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError") return "cancelled";
  }
  const copied = await copyText(text);
  return copied ? "copied" : "failed";
}

export async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
