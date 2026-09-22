import { getSupabase } from "./supabase";
import { compareCompsByDate, type DateSortDir } from "./filter";
import type { Competition } from "./types";

export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LENGTH = 8;

export const GUEST_FRIENDS_TITLE = "Friends unlock when you sign in";
export const GUEST_FRIENDS_BODY =
  "Sign in to find friends at your dance studio. Parents can add other parents, and dancers can add other dancers. You will see comps a friend has marked Enrolled — not their date of birth.";

export const NO_STUDIO_FRIENDS_COPY =
  "Link a dancer to a studio to find friends there";

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
    return "Friends is not set up on this project yet. Run the friends SQL in Supabase, then try again.";
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
    return "That person is not on your studio list.";
  }
  if (lower.includes("same account type") || lower.includes("other parents") || lower.includes("other dancers")) {
    return "You can only add friends with the same account type. Parents add parents, and dancers add dancers.";
  }
  if (lower.includes("not at your studio") || lower.includes("inside your studio") || lower.includes("same approved studio")) {
    return "You can only add friends at the same approved studio.";
  }
  if (lower.includes("studio accounts")) {
    return "Studio accounts do not add friends here.";
  }
  if (lower.includes("link a dancer")) {
    return NO_STUDIO_FRIENDS_COPY + ".";
  }
  if (lower.includes("already friends")) {
    return "You are already friends.";
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
    return "Only the person who received the request can accept or decline it.";
  }
  if (lower.includes("not your friend")) {
    return "Only the two of you can remove that friend.";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StudioFriendRole = "parent" | "dancer" | "studio" | "none";
export type StudioFriendStatus = "none" | "pending_in" | "pending_out" | "accepted";

export interface StudioFriendDancer {
  childId: string;
  name: string;
  enrolledCompIds: string[];
}

export interface StudioFriendPerson {
  userId: string;
  label: string;
  status: StudioFriendStatus;
  friendshipId: string | null;
  childId: string | null;
  enrolledCompIds: string[];
  dancers: StudioFriendDancer[];
}

export interface StudioFriendGroup {
  studioId: string;
  studioName: string;
  people: StudioFriendPerson[];
}

export interface StudioFriendsDirectory {
  role: StudioFriendRole;
  studios: StudioFriendGroup[];
}

export function friendRolesAllowed(
  actor: string | null | undefined,
  target: string | null | undefined,
): boolean {
  return (
    (actor === "parent" && target === "parent") ||
    (actor === "dancer" && target === "dancer")
  );
}

export function emptyStudioFriendsDirectory(): StudioFriendsDirectory {
  return { role: "none", studios: [] };
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

function parseFriendStatus(value: unknown): StudioFriendStatus {
  if (
    value === "none" ||
    value === "pending_in" ||
    value === "pending_out" ||
    value === "accepted"
  ) {
    return value;
  }
  return "none";
}

function safeFriendLabel(value: unknown, role: StudioFriendRole): string {
  const label = asString(value).trim();
  if (!label || label.includes("@")) {
    return role === "dancer" ? "Dancer" : "Parent";
  }
  return label;
}

function parseStudioFriendDancer(raw: unknown): StudioFriendDancer | null {
  const row = asRecord(raw);
  if (!row) return null;
  const childId = asString(row.child_id || row.childId).trim();
  const name = asString(row.name).trim();
  if (!childId || !name || name.includes("@")) return null;
  return {
    childId,
    name,
    enrolledCompIds: asStringArray(row.enrolled_comp_ids ?? row.enrolledCompIds),
  };
}

function parseStudioFriendPerson(
  raw: unknown,
  role: StudioFriendRole,
): StudioFriendPerson | null {
  const row = asRecord(raw);
  if (!row) return null;
  const userId = asUuid(row.user_id ?? row.userId);
  if (!userId) return null;
  const status = parseFriendStatus(row.status);
  const friendshipId = asUuid(row.friendship_id ?? row.friendshipId);
  const childId = asString(row.child_id || row.childId).trim() || null;
  const dancers = Array.isArray(row.dancers)
    ? row.dancers
        .map(parseStudioFriendDancer)
        .filter((item): item is StudioFriendDancer => Boolean(item))
    : [];
  return {
    userId,
    label: safeFriendLabel(row.label ?? row.name, role),
    status,
    friendshipId: status === "none" ? null : friendshipId,
    childId,
    enrolledCompIds: asStringArray(row.enrolled_comp_ids ?? row.enrolledCompIds),
    dancers,
  };
}

export function parseStudioFriendsDirectory(raw: unknown): StudioFriendsDirectory {
  const row = asRecord(raw) ?? {};
  const roleValue = asString(row.role);
  const role: StudioFriendRole =
    roleValue === "parent" || roleValue === "dancer" || roleValue === "studio"
      ? roleValue
      : "none";
  const studios = Array.isArray(row.studios) ? row.studios : [];
  return {
    role,
    studios: studios
      .map((item) => {
        const studio = asRecord(item);
        if (!studio) return null;
        const studioId = asUuid(studio.studio_id ?? studio.studioId);
        const studioName = asString(studio.studio_name ?? studio.studioName).trim();
        if (!studioId || !studioName || studioName.includes("@")) return null;
        const people = Array.isArray(studio.people) ? studio.people : [];
        return {
          studioId,
          studioName,
          people: people
            .map((person) => parseStudioFriendPerson(person, role))
            .filter((person): person is StudioFriendPerson => Boolean(person))
            .sort((a, b) => a.label.localeCompare(b.label, "en-AU")),
        };
      })
      .filter((studio): studio is StudioFriendGroup => Boolean(studio))
      .sort((a, b) => a.studioName.localeCompare(b.studioName, "en-AU")),
  };
}

export function splitStudioPeople(people: StudioFriendPerson[]): {
  addable: StudioFriendPerson[];
  incoming: StudioFriendPerson[];
  outgoing: StudioFriendPerson[];
  friends: StudioFriendPerson[];
} {
  return {
    addable: people.filter((person) => person.status === "none"),
    incoming: people.filter((person) => person.status === "pending_in"),
    outgoing: people.filter((person) => person.status === "pending_out"),
    friends: people.filter((person) => person.status === "accepted"),
  };
}

export function filterPeopleByQuery(
  people: StudioFriendPerson[],
  query: string,
): StudioFriendPerson[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return people;
  return people.filter((person) => {
    if (person.label.toLowerCase().includes(needle)) return true;
    return person.dancers.some((dancer) =>
      dancer.name.toLowerCase().includes(needle),
    );
  });
}

export function countIncomingStudioFriends(
  directory: StudioFriendsDirectory,
): number {
  return directory.studios.reduce(
    (total, studio) =>
      total + studio.people.filter((person) => person.status === "pending_in").length,
    0,
  );
}

export function enrolledDancersFromDirectory(
  directory: StudioFriendsDirectory,
  studioId?: string | null,
): AcceptedFriend[] {
  const map = new Map<string, AcceptedFriend>();
  for (const studio of directory.studios) {
    if (studioId && studio.studioId !== studioId) continue;
    for (const person of studio.people) {
      if (person.status !== "accepted") continue;
      const dancers =
        person.dancers.length > 0
          ? person.dancers
          : person.childId
            ? [
                {
                  childId: person.childId,
                  name: person.label,
                  enrolledCompIds: person.enrolledCompIds,
                },
              ]
            : [];
      for (const dancer of dancers) {
        const existing = map.get(dancer.childId);
        if (!existing) {
          map.set(dancer.childId, {
            friendshipId: person.friendshipId ?? dancer.childId,
            childId: dancer.childId,
            name: dancer.name,
            enrolledCompIds: [...dancer.enrolledCompIds],
          });
          continue;
        }
        const ids = new Set([...existing.enrolledCompIds, ...dancer.enrolledCompIds]);
        map.set(dancer.childId, {
          ...existing,
          enrolledCompIds: [...ids],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "en-AU"));
}

export async function loadStudioFriends(): Promise<{
  directory: StudioFriendsDirectory | null;
  error: string | null;
}> {
  const { data, error } = await rpc<unknown>("list_studio_friends", {});
  if (error) return { directory: null, error };
  return { directory: parseStudioFriendsDirectory(data), error: null };
}

export async function sendStudioFriendRequest(
  studioId: string,
  targetUserId: string,
): Promise<FriendActionResult> {
  const { data, error } = await rpc<unknown>("send_studio_friend_request", {
    p_studio_id: studioId,
    p_target_user_id: targetUserId,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: asBoolean(row.ok, true),
    status: asString(row.status) as FriendshipStatus,
    friendshipId: asString(row.friendship_id || row.friendshipId) || undefined,
  };
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
