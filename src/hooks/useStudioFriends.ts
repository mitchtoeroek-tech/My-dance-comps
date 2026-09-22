"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  loadStudioFriends,
  type StudioFriendDirectory,
} from "@/lib/studio-friends";

export type StudioFriendsViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

export function useStudioFriends(studioId: string | null) {
  const { configured, ready: authReady, user } = useAuth();
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    generation: number;
    studioId: string;
    directory: StudioFriendDirectory | null;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user || !studioId) return;
    const gen = generation;
    const id = studioId;
    let cancelled = false;
    void loadStudioFriends(id).then((next) => {
      if (cancelled) return;
      setResult({
        generation: gen,
        studioId: id,
        directory: next.directory,
        error: next.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, studioId, generation]);

  const matched = result && result.studioId === studioId ? result : null;
  const loading = Boolean(
    user &&
      studioId &&
      (!matched || matched.generation !== generation),
  );

  let view: StudioFriendsViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (!studioId) view = "error";
  else if (loading && !matched?.directory) view = "loading";
  else if (matched?.error && !matched.directory) view = "error";
  else view = "ready";

  return {
    view,
    directory: matched?.directory ?? null,
    error: matched?.error ?? null,
    loading,
    reload,
  };
}
