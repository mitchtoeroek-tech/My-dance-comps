"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStudioFriends } from "@/hooks/useFriends";
import {
  loadCommunityMessages,
  loadCommunityPreviews,
  mergeCommunityConversations,
  mergeCommunityMessages,
  parseCommunityMessage,
  sendCommunityMessage,
  studioFriendConversationRows,
  type CommunityConversation,
  type CommunityMessage,
} from "@/lib/community";
import {
  countIncomingStudioFriends,
  type StudioFriendRole,
} from "@/lib/friends";
import { getSupabase } from "@/lib/supabase";

export type CommunityViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

const THREAD_POLL_MS = 8_000;

export function useCommunityInbox() {
  const { configured, ready: authReady, user } = useAuth();
  const friends = useStudioFriends();
  const directoryKey = friends.directory
    ? friends.directory.studios
        .map((studio) =>
          [
            studio.studioId,
            ...studio.people
              .filter((person) => person.status === "accepted" && person.friendshipId)
              .map((person) => `${person.friendshipId}:${person.label}`),
          ].join(","),
        )
        .join("|")
    : "";
  const [result, setResult] = useState<{
    key: string;
    conversations: CommunityConversation[];
    error: string | null;
  } | null>(null);

  const reloadFriends = friends.reload;
  const reload = useCallback(() => {
    reloadFriends();
  }, [reloadFriends]);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    if (
      friends.view === "loading" ||
      friends.view === "guest" ||
      friends.view === "unavailable" ||
      friends.view === "error" ||
      !friends.directory
    ) {
      return;
    }
    const key = directoryKey;
    const directory = friends.directory;
    let cancelled = false;
    void (async () => {
      const accepted = studioFriendConversationRows(directory);
      const previews = await loadCommunityPreviews(
        accepted.map((row) => row.friend.friendshipId),
      );
      if (cancelled) return;
      setResult({
        key,
        conversations: mergeCommunityConversations(accepted, previews.lastByThread),
        error: previews.error,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    configured,
    user,
    friends.view,
    friends.directory,
    friends.error,
    directoryKey,
  ]);

  const matched = result && result.key === directoryKey ? result : null;
  const incomingCount = friends.directory
    ? countIncomingStudioFriends(friends.directory)
    : 0;
  const role: StudioFriendRole = friends.directory?.role ?? "none";
  const hasStudio = (friends.directory?.studios.length ?? 0) > 0;
  const loading = Boolean(
    user &&
      (friends.view === "loading" ||
        (friends.view === "ready" && (!matched || matched.key !== directoryKey))),
  );

  let view: CommunityViewState = "loading";
  if (!authReady || friends.view === "loading") view = "loading";
  else if (!configured || friends.view === "unavailable") view = "unavailable";
  else if (!user || friends.view === "guest") view = "guest";
  else if (loading && !matched) view = "loading";
  else if ((matched?.error || friends.error) && (matched?.conversations.length ?? 0) === 0) {
    view = "error";
  } else view = "ready";

  return {
    view,
    conversations: matched?.conversations ?? [],
    incomingCount,
    error: matched?.error ?? friends.error,
    loading,
    reload,
    role,
    hasStudio,
  };
}

export function useCommunityThread(friendshipId: string | null) {
  const { user } = useAuth();
  const inbox = useCommunityInbox();
  const conversation = useMemo(
    () =>
      inbox.conversations.find((row) => row.friendshipId === friendshipId) ??
      null,
    [inbox.conversations, friendshipId],
  );
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [threadKey, setThreadKey] = useState(friendshipId);
  if (threadKey !== friendshipId) {
    setThreadKey(friendshipId);
    setMessages([]);
    setThreadError(null);
  }

  const applyIncoming = useCallback((incoming: CommunityMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => mergeCommunityMessages(current, incoming));
  }, []);

  useEffect(() => {
    if (!friendshipId || !user) return;
    let cancelled = false;
    const refresh = async () => {
      const next = await loadCommunityMessages(friendshipId);
      if (cancelled) return;
      setThreadError(next.error);
      applyIncoming(next.messages);
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, THREAD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyIncoming, friendshipId, user]);

  useEffect(() => {
    if (!friendshipId || !user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`community:${friendshipId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `friendship_id=eq.${friendshipId}`,
        },
        (payload) => {
          const parsed = parseCommunityMessage(payload.new);
          if (parsed) applyIncoming([parsed]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyIncoming, friendshipId, user]);

  const send = useCallback(
    async (raw: string) => {
      if (!friendshipId || !user) {
        return { error: "Sign in to send a message." };
      }
      setSending(true);
      const result = await sendCommunityMessage({
        friendshipId,
        senderUserId: user.id,
        body: raw,
      });
      setSending(false);
      if (result.message) {
        applyIncoming([result.message]);
        setThreadError(null);
      }
      if (result.error) setThreadError(result.error);
      return { error: result.error };
    },
    [applyIncoming, friendshipId, user],
  );

  return {
    ...inbox,
    conversation,
    messages,
    threadError,
    sending,
    send,
    userId: user?.id ?? null,
  };
}
