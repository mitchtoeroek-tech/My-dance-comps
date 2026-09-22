"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  loadFamilySiblings,
  type SiblingFriendDirectory,
} from "@/lib/sibling-friends";

export type SiblingFriendsViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

export function useSiblingFriends(enabled: boolean) {
  const { configured, ready: authReady, user } = useAuth();
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    generation: number;
    directory: SiblingFriendDirectory | null;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user || !enabled) return;
    const gen = generation;
    let cancelled = false;
    void loadFamilySiblings().then((next) => {
      if (cancelled) return;
      setResult({
        generation: gen,
        directory: next.directory,
        error: next.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, enabled, generation]);

  const loading = Boolean(enabled && user && (!result || result.generation !== generation));

  let view: SiblingFriendsViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (!enabled) view = "ready";
  else if (loading && !result?.directory) view = "loading";
  else if (result?.error && !result.directory) view = "error";
  else view = "ready";

  return {
    view,
    directory: enabled ? (result?.directory ?? null) : null,
    error: enabled ? (result?.error ?? null) : null,
    loading,
    reload,
  };
}
