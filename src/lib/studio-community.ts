import {
  COMMUNITY_MESSAGE_MAX,
  COMMUNITY_THREAD_LIMIT,
  communityMessagePreview,
  sanitizeCommunityMessage,
} from "./community";
import { parseStudioId, studioLogoPublicUrl } from "./studios";
import { getSupabase } from "./supabase";

export const STUDIO_COMMUNITY_MESSAGE_MAX = COMMUNITY_MESSAGE_MAX;
export const STUDIO_COMMUNITY_THREAD_LIMIT = COMMUNITY_THREAD_LIMIT;

export const STUDIO_CHAT_EMPTY_BODY =
  "Link a dancer to an approved studio to join its chat.";

export interface StudioCommunityMessage {
  id: string;
  studioId: string;
  senderUserId: string;
  senderLabel: string;
  body: string;
  createdAt: string;
}

export interface StudioChatSummary {
  studioId: string;
  name: string;
  slug: string;
  logoPath: string | null;
  updatedAt: string;
  lastBody: string | null;
  lastSenderLabel: string | null;
  lastCreatedAt: string | null;
}

type RpcError = { message?: string; code?: string } | null;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function studioCommunityThreadPath(studioId: string): string {
  const id = parseStudioId(studioId) ?? studioId.trim();
  return `/community/studio/${encodeURIComponent(id)}`;
}

export function sanitizeStudioCommunityMessage(raw: string): string | null {
  return sanitizeCommunityMessage(raw);
}

/** Hide anything that looks like an email. The database sets the real label. */
export function safeStudioSenderLabel(label: string | null | undefined): string {
  const trimmed = (label ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.includes("@")) return "Member";
  return trimmed.slice(0, 160);
}

export function studioChatLogoUrl(
  chat: Pick<StudioChatSummary, "logoPath" | "updatedAt">,
): string | null {
  return studioLogoPublicUrl(chat.logoPath, chat.updatedAt);
}

export function studioChatListPreview(chat: {
  lastBody: string | null;
  lastSenderLabel: string | null;
}): string {
  const body = chat.lastBody?.trim() ?? "";
  if (!body) return "No messages yet — say hello.";
  const label = chat.lastSenderLabel
    ? safeStudioSenderLabel(chat.lastSenderLabel)
    : "";
  const line = label ? `${label}: ${body}` : body;
  return communityMessagePreview(line);
}

export function friendlyStudioCommunityError(
  error: RpcError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("row-level security") ||
    lower.includes("violates row-level")
  ) {
    return "You can only use studio chat for an approved studio you belong to.";
  }
  if (
    lower.includes("studio_community_messages_body_len") ||
    lower.includes("check constraint")
  ) {
    return "Type a message of 2,000 characters or fewer.";
  }
  if (lower.includes("not authenticated") || lower.includes("jwt")) {
    return "Sign in to use studio chat.";
  }
  if (
    lower.includes("could not find the function") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    (lower.includes("studio_community") && lower.includes("does not exist"))
  ) {
    return "Studio chat is not set up on this project yet. Run the studio chat SQL in Supabase, then try again.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^error:\s*/i, "");
}

export function parseStudioCommunityMessage(
  raw: unknown,
): StudioCommunityMessage | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id).trim();
  const studioId = parseStudioId(row.studio_id ?? row.studioId);
  const senderUserId = asString(row.sender_user_id ?? row.senderUserId).trim();
  const body = asString(row.body);
  const createdAt = asString(row.created_at ?? row.createdAt).trim();
  if (!id || !studioId || !senderUserId || !body.trim() || !createdAt) return null;
  return {
    id,
    studioId,
    senderUserId,
    senderLabel: safeStudioSenderLabel(
      asString(row.sender_label ?? row.senderLabel, "Member"),
    ),
    body,
    createdAt,
  };
}

export function parseStudioCommunityMessages(raw: unknown): StudioCommunityMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseStudioCommunityMessage)
    .filter((item): item is StudioCommunityMessage => Boolean(item));
}

export function mergeStudioCommunityMessages(
  current: StudioCommunityMessage[],
  incoming: StudioCommunityMessage[],
): StudioCommunityMessage[] {
  const map = new Map<string, StudioCommunityMessage>();
  for (const message of [...current, ...incoming]) {
    map.set(message.id, message);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });
}

export function parseStudioChat(raw: unknown): StudioChatSummary | null {
  const row = asRecord(raw);
  if (!row) return null;
  const studioId = parseStudioId(row.studio_id ?? row.studioId ?? row.id);
  const name = asString(row.name).trim();
  if (!studioId || !name) return null;
  const lastBody = asString(row.last_body ?? row.lastBody).trim();
  const lastCreatedAt = asString(row.last_created_at ?? row.lastCreatedAt).trim();
  const lastSender = asString(row.last_sender_label ?? row.lastSenderLabel).trim();
  return {
    studioId,
    name,
    slug: asString(row.slug).trim() || studioId,
    logoPath: asString(row.logo_path ?? row.logoPath).trim() || null,
    updatedAt: asString(row.updated_at ?? row.updatedAt).trim(),
    lastBody: lastBody || null,
    lastSenderLabel: lastSender ? safeStudioSenderLabel(lastSender) : null,
    lastCreatedAt: lastCreatedAt || null,
  };
}

export function parseStudioChats(raw: unknown): StudioChatSummary[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, StudioChatSummary>();
  for (const row of raw) {
    const chat = parseStudioChat(row);
    if (!chat) continue;
    const current = map.get(chat.studioId);
    if (!current) {
      map.set(chat.studioId, chat);
      continue;
    }
    const currentTime = current.lastCreatedAt ?? "";
    const nextTime = chat.lastCreatedAt ?? "";
    if (nextTime >= currentTime) {
      map.set(chat.studioId, {
        ...chat,
        logoPath: chat.logoPath ?? current.logoPath,
        updatedAt: chat.updatedAt || current.updatedAt,
        slug: chat.slug || current.slug,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const aTime = a.lastCreatedAt ?? "";
    const bTime = b.lastCreatedAt ?? "";
    if (aTime !== bTime) return bTime.localeCompare(aTime);
    return a.name.localeCompare(b.name, "en-AU");
  });
}

export async function loadStudioChats(): Promise<{
  chats: StudioChatSummary[];
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      chats: [],
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const { data, error } = await supabase.rpc("list_my_studio_chats");
  if (error) return { chats: [], error: friendlyStudioCommunityError(error) };
  return { chats: parseStudioChats(data), error: null };
}

export async function loadStudioChatAccess(studioId: string): Promise<{
  member: boolean;
  error: string | null;
}> {
  const id = parseStudioId(studioId);
  if (!id) return { member: false, error: "That studio chat link is not valid." };
  const supabase = getSupabase();
  if (!supabase) {
    return {
      member: false,
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const { data, error } = await supabase.rpc("is_studio_chat_member", {
    p_studio_id: id,
  });
  if (error) return { member: false, error: friendlyStudioCommunityError(error) };
  return { member: data === true, error: null };
}

export async function loadStudioCommunityMessages(
  studioId: string,
): Promise<{ messages: StudioCommunityMessage[]; error: string | null }> {
  const id = parseStudioId(studioId);
  const supabase = getSupabase();
  if (!supabase) {
    return {
      messages: [],
      error: "Accounts are not connected in this environment yet.",
    };
  }
  if (!id) return { messages: [], error: "That studio chat link is not valid." };
  const { data, error } = await supabase
    .from("studio_community_messages")
    .select("id, studio_id, sender_user_id, sender_label, body, created_at")
    .eq("studio_id", id)
    .order("created_at", { ascending: true })
    .limit(STUDIO_COMMUNITY_THREAD_LIMIT);
  if (error) return { messages: [], error: friendlyStudioCommunityError(error) };
  return { messages: parseStudioCommunityMessages(data), error: null };
}

export async function sendStudioCommunityMessage(input: {
  studioId: string;
  senderUserId: string;
  body: string;
}): Promise<{ message: StudioCommunityMessage | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      message: null,
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const id = parseStudioId(input.studioId);
  const body = sanitizeStudioCommunityMessage(input.body);
  if (!body) return { message: null, error: "Type a message first." };
  if (!id) return { message: null, error: "That studio chat is not valid." };
  const { data, error } = await supabase
    .from("studio_community_messages")
    .insert({
      studio_id: id,
      sender_user_id: input.senderUserId,
      body,
    })
    .select("id, studio_id, sender_user_id, sender_label, body, created_at")
    .single();
  if (error) return { message: null, error: friendlyStudioCommunityError(error) };
  const message = parseStudioCommunityMessage(data);
  if (!message) {
    return { message: null, error: "Message could not be sent. Please try again." };
  }
  return { message, error: null };
}
