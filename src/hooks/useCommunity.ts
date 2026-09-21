"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import {
  loadCommunityMessages,
  loadCommunityPreviews,
  mergeCommunityConversations,
  mergeCommunityMessages,
  parseCommunityMessage,
  sendCommunityMessage,
  type CommunityConversation,
  type CommunityMessage,
} from "@/lib/community";
import {
  loadFriendsForChild,
  type FriendsSnapshot,
} from "@/lib/friends";
import { getSupabase } from "@/lib/supabase";

export type CommunityViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

const INBOX_POLL_MS = 12_000;
const THREAD_POLL_MS = 8_000;

export function useCommunityInbox() {
  const { configured, ready: authReady, user } = useAuth();
  const { state } = useFamily();
  const children = Array.isArray(state.children) ? state.children : [];
  const childKey = children.map((child) => `${child.id}:${child.name}`).join("|");
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    generation: number;
    conversations: CommunityConversation[];
    incomingCount: number;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const gen = generation;
    const rows = childKey
      ? childKey.split("|").map((entry) => {
          const idx = entry.indexOf(":");
          return { id: entry.slice(0, idx), name: entry.slice(idx + 1) };
        })
      : [];
    if (rows.length === 0) {
      setResult({
        key: childKey,
        generation: gen,
        conversations: [],
        incomingCount: 0,
        error: null,
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      const snapshots = await Promise.all(
        rows.map(async (row) => {
          const loaded = await loadFriendsForChild(row.id);
          return { ...row, loaded };
        }),
      );
      if (cancelled) return;
      const accepted: Array<{
        ownChildId: string;
        ownChildName: string;
        friend: FriendsSnapshot["friends"][number];
      }> = [];
      let incomingCount = 0;
      let friendError: string | null = null;
      for (const row of snapshots) {
        if (row.loaded.error && !friendError) friendError = row.loaded.error;
        if (!row.loaded.snapshot) continue;
        incomingCount += row.loaded.snapshot.incoming.length;
        for (const friend of row.loaded.snapshot.friends) {
          accepted.push({
            ownChildId: row.id,
            ownChildName: row.name,
            friend,
          });
        }
      }
      const previews = await loadCommunityPreviews(
        accepted.map((row) => row.friend.friendshipId),
      );
      if (cancelled) return;
      setResult({
        key: childKey,
        generation: gen,
        conversations: mergeCommunityConversations(
          accepted,
          previews.lastByThread,
        ),
        incomingCount,
        error: previews.error ?? friendError,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, childKey, generation]);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const timer = window.setInterval(() => {
      setGeneration((value) => value + 1);
    }, INBOX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [authReady, configured, user]);

  const matched = result && result.key === childKey ? result : null;
  const loading = Boolean(user && (!matched || matched.generation !== generation));

  let view: CommunityViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (loading && !matched) view = "loading";
  else if (matched?.error && matched.conversations.length === 0) view = "error";
  else view = "ready";

  return {
    view,
    conversations: matched?.conversations ?? [],
    incomingCount: matched?.incomingCount ?? 0,
    error: matched?.error ?? null,
    loading,
    reload,
    childrenCount: children.length,
    firstChildId: children[0]?.id ?? null,
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

  const applyIncoming = useCallback((incoming: CommunityMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => mergeCommunityMessages(current, incoming));
  }, []);

  useEffect(() => {
    setMessages([]);
    setThreadError(null);
  }, [friendshipId]);

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
