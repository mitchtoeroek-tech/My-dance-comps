"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchStudioBySlugOrId, type StudioRecord } from "@/lib/studios";
import {
  loadStudioChatAccess,
  loadStudioChats,
  loadStudioCommunityMessages,
  mergeStudioCommunityMessages,
  parseStudioCommunityMessage,
  sendStudioCommunityMessage,
  type StudioChatSummary,
  type StudioCommunityMessage,
} from "@/lib/studio-community";
import { getSupabase } from "@/lib/supabase";

export type StudioCommunityViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

const INBOX_POLL_MS = 12_000;
const THREAD_POLL_MS = 8_000;

export function useStudioChats() {
  const { configured, ready: authReady, user, account } = useAuth();
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    userId: string;
    generation: number;
    chats: StudioChatSummary[];
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const gen = generation;
    let cancelled = false;
    void (async () => {
      const loaded = await loadStudioChats();
      if (cancelled) return;
      setResult({
        userId: user.id,
        generation: gen,
        chats: loaded.chats,
        error: loaded.error,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, generation]);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const timer = window.setInterval(() => {
      setGeneration((value) => value + 1);
    }, INBOX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [authReady, configured, user]);

  const matched = result && user && result.userId === user.id ? result : null;
  const loading = Boolean(user && (!matched || matched.generation !== generation));

  let view: StudioCommunityViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (loading && !matched) view = "loading";
  else if (matched?.error && matched.chats.length === 0) view = "error";
  else view = "ready";

  return {
    view,
    chats: matched?.chats ?? [],
    error: matched?.error ?? null,
    loading,
    reload,
    role: account?.role ?? null,
  };
}

export function useStudioCommunityThread(studioId: string | null) {
  const { configured, ready: authReady, user } = useAuth();
  const scope = user && studioId ? `${user.id}:${studioId}` : null;
  const [thread, setThread] = useState<{
    scope: string;
    studio: StudioRecord | null;
    member: boolean;
    accessError: string | null;
    messages: StudioCommunityMessage[];
    threadError: string | null;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const active = thread && thread.scope === scope ? thread : null;

  const applyIncoming = useCallback(
    (incoming: StudioCommunityMessage[], error: string | null = null) => {
      if (!scope || (incoming.length === 0 && error === null)) return;
      setThread((current) => {
        if (!current || current.scope !== scope) return current;
        return {
          ...current,
          messages:
            incoming.length === 0
              ? current.messages
              : mergeStudioCommunityMessages(current.messages, incoming),
          threadError: error,
        };
      });
    },
    [scope],
  );

  useEffect(() => {
    if (!authReady || !configured || !user || !studioId || !scope) return;
    let cancelled = false;
    void (async () => {
      const [access, loaded] = await Promise.all([
        loadStudioChatAccess(studioId),
        fetchStudioBySlugOrId(studioId),
      ]);
      if (cancelled) return;
      setThread({
        scope,
        studio: loaded.studio,
        member: access.member,
        accessError: access.error,
        messages: [],
        threadError: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, scope, studioId, user]);

  useEffect(() => {
    if (!studioId || !scope || !active?.member) return;
    let cancelled = false;
    const refresh = async () => {
      const next = await loadStudioCommunityMessages(studioId);
      if (cancelled) return;
      applyIncoming(next.messages, next.error);
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, THREAD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active?.member, applyIncoming, scope, studioId]);

  useEffect(() => {
    if (!studioId || !scope || !active?.member) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`studio-community:${studioId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "studio_community_messages",
          filter: `studio_id=eq.${studioId}`,
        },
        (payload) => {
          const parsed = parseStudioCommunityMessage(payload.new);
          if (parsed) applyIncoming([parsed], null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active?.member, applyIncoming, scope, studioId]);

  const send = useCallback(
    async (raw: string) => {
      if (!studioId || !user || !scope || !active?.member) {
        return { error: "Sign in as a studio member to send a message." };
      }
      setSending(true);
      const result = await sendStudioCommunityMessage({
        studioId,
        senderUserId: user.id,
        body: raw,
      });
      setSending(false);
      if (result.message) applyIncoming([result.message], null);
      else if (result.error) applyIncoming([], result.error);
      return { error: result.error };
    },
    [active?.member, applyIncoming, scope, studioId, user],
  );

  let view: StudioCommunityViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (!active) view = "loading";
  else if (active.accessError && !active.member) view = "error";
  else view = "ready";

  return {
    view,
    studio: active?.studio ?? null,
    member: active?.member === true,
    accessError: active?.accessError ?? null,
    messages: active?.messages ?? [],
    threadError: active?.threadError ?? null,
    sending,
    send,
    userId: user?.id ?? null,
  };
}
