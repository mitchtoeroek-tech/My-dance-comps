import { getSupabase } from "./supabase";
import { ADELAIDE_TZ } from "./datetime";
import type { AcceptedFriend } from "./friends";

export const COMMUNITY_MESSAGE_MAX = 2000;
export const COMMUNITY_THREAD_LIMIT = 200;

export const GUEST_COMMUNITY_TITLE = "Community unlocks when you sign in";
export const GUEST_COMMUNITY_BODY =
  "Sign in to chat with accepted friends. There is no open public chat — only families you have already added as friends.";

const FRIENDSHIP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CommunityMessage {
  id: string;
  friendshipId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

export interface CommunityConversation {
  friendshipId: string;
  friendChildId: string;
  friendName: string;
  ownChildId: string;
  ownChildName: string;
  lastMessage: CommunityMessage | null;
}

type RpcError = { message?: string; code?: string } | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isCommunityFriendshipId(value: string): boolean {
  return FRIENDSHIP_ID_RE.test(value.trim());
}

export function communityThreadPath(friendshipId: string): string {
  return `/community/${encodeURIComponent(friendshipId.trim())}`;
}

export function sanitizeCommunityMessage(raw: string): string | null {
  const trimmed = raw.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return null;
  if (trimmed.length <= COMMUNITY_MESSAGE_MAX) return trimmed;
  return trimmed.slice(0, COMMUNITY_MESSAGE_MAX);
}

export function communityMessagePreview(body: string, max = 72): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, Math.max(1, max - 1))}…`;
}

export function friendlyCommunityError(
  error: RpcError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("row-level security") ||
    lower.includes("violates row-level")
  ) {
    return "You can only chat with accepted friends.";
  }
  if (lower.includes("not authenticated") || lower.includes("jwt")) {
    return "Sign in to use Community.";
  }
  if (
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    (lower.includes("community_messages") && lower.includes("does not exist"))
  ) {
    return "Community chat is not set up on this project yet. Run the community chat SQL in Supabase, then try again.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^error:\s*/i, "");
}

export function parseCommunityMessage(raw: unknown): CommunityMessage | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id).trim();
  const friendshipId = asString(
    row.friendship_id ?? row.friendshipId,
  ).trim();
  const senderUserId = asString(
    row.sender_user_id ?? row.senderUserId,
  ).trim();
  const body = asString(row.body);
  const createdAt = asString(row.created_at ?? row.createdAt).trim();
  if (!id || !isCommunityFriendshipId(friendshipId) || !senderUserId) {
    return null;
  }
  if (!body.trim() || !createdAt) return null;
  return { id, friendshipId, senderUserId, body, createdAt };
}

export function parseCommunityMessages(raw: unknown): CommunityMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseCommunityMessage)
    .filter((item): item is CommunityMessage => Boolean(item));
}

export function latestMessageByThread(
  messages: CommunityMessage[],
): Map<string, CommunityMessage> {
  const map = new Map<string, CommunityMessage>();
  for (const message of messages) {
    const current = map.get(message.friendshipId);
    if (!current || current.createdAt < message.createdAt) {
      map.set(message.friendshipId, message);
    }
  }
  return map;
}

export function mergeCommunityConversations(
  rows: Array<{
    ownChildId: string;
    ownChildName: string;
    friend: AcceptedFriend;
  }>,
  lastByThread: Map<string, CommunityMessage>,
): CommunityConversation[] {
  const map = new Map<string, CommunityConversation>();
  for (const row of rows) {
    const friendshipId = row.friend.friendshipId.trim();
    if (!isCommunityFriendshipId(friendshipId)) continue;
    if (map.has(friendshipId)) continue;
    map.set(friendshipId, {
      friendshipId,
      friendChildId: row.friend.childId,
      friendName: row.friend.name,
      ownChildId: row.ownChildId,
      ownChildName: row.ownChildName,
      lastMessage: lastByThread.get(friendshipId) ?? null,
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? "";
    const bTime = b.lastMessage?.createdAt ?? "";
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    const names = a.friendName.localeCompare(b.friendName, "en-AU");
    if (names !== 0) return names;
    return a.ownChildName.localeCompare(b.ownChildName, "en-AU");
  });
}

export function mergeCommunityMessages(
  current: CommunityMessage[],
  incoming: CommunityMessage[],
): CommunityMessage[] {
  const map = new Map<string, CommunityMessage>();
  for (const message of [...current, ...incoming]) {
    map.set(message.id, message);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });
}

export function formatCommunityTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = adelaideCalendarDate(date) === adelaideCalendarDate(now);
  try {
    if (sameDay) {
      return new Intl.DateTimeFormat("en-AU", {
        timeZone: ADELAIDE_TZ,
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: ADELAIDE_TZ,
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return iso;
  }
}

function adelaideCalendarDate(instant: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: ADELAIDE_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    /* fall through */
  }
  return instant.toISOString().slice(0, 10);
}

export async function loadCommunityMessages(
  friendshipId: string,
): Promise<{ messages: CommunityMessage[]; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      messages: [],
      error: "Accounts are not connected in this environment yet.",
    };
  }
  if (!isCommunityFriendshipId(friendshipId)) {
    return { messages: [], error: "That chat link is not valid." };
  }
  const { data, error } = await supabase
    .from("community_messages")
    .select("id, friendship_id, sender_user_id, body, created_at")
    .eq("friendship_id", friendshipId)
    .order("created_at", { ascending: true })
    .limit(COMMUNITY_THREAD_LIMIT);
  if (error) return { messages: [], error: friendlyCommunityError(error) };
  return { messages: parseCommunityMessages(data), error: null };
}

export async function loadCommunityPreviews(
  friendshipIds: string[],
): Promise<{
  lastByThread: Map<string, CommunityMessage>;
  error: string | null;
}> {
  const ids = friendshipIds.filter(isCommunityFriendshipId);
  if (ids.length === 0) {
    return { lastByThread: new Map(), error: null };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return {
      lastByThread: new Map(),
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const { data, error } = await supabase
    .from("community_messages")
    .select("id, friendship_id, sender_user_id, body, created_at")
    .in("friendship_id", ids)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, ids.length * 4));
  if (error) {
    return { lastByThread: new Map(), error: friendlyCommunityError(error) };
  }
  return {
    lastByThread: latestMessageByThread(parseCommunityMessages(data)),
    error: null,
  };
}

export async function sendCommunityMessage(input: {
  friendshipId: string;
  senderUserId: string;
  body: string;
}): Promise<{ message: CommunityMessage | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      message: null,
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const body = sanitizeCommunityMessage(input.body);
  if (!body) return { message: null, error: "Type a message first." };
  if (!isCommunityFriendshipId(input.friendshipId)) {
    return { message: null, error: "That chat is not valid." };
  }
  const { data, error } = await supabase
    .from("community_messages")
    .insert({
      friendship_id: input.friendshipId,
      sender_user_id: input.senderUserId,
      body,
    })
    .select("id, friendship_id, sender_user_id, body, created_at")
    .single();
  if (error) return { message: null, error: friendlyCommunityError(error) };
  const message = parseCommunityMessage(data);
  if (!message) {
    return { message: null, error: "Message could not be sent. Please try again." };
  }
  return { message, error: null };
}
