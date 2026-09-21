"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  loadFriendsForChild,
  type FriendsSnapshot,
} from "@/lib/friends";

export type FriendsViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

export function useFriends(childId: string | null) {
  const { configured, ready: authReady, user } = useAuth();
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    generation: number;
    forChildId: string;
    snapshot: FriendsSnapshot | null;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user || !childId) return;
    const gen = generation;
    const id = childId;
    let cancelled = false;
    void loadFriendsForChild(id).then((next) => {
      if (cancelled) return;
      setResult({
        generation: gen,
        forChildId: id,
        snapshot: next.snapshot,
        error: next.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, childId, generation]);

  const snapshot =
    result && result.forChildId === childId ? result.snapshot : null;
  const error = result && result.forChildId === childId ? result.error : null;
  const loading = Boolean(
    user &&
      childId &&
      (!result ||
        result.forChildId !== childId ||
        result.generation !== generation),
  );

  let view: FriendsViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (loading && !snapshot) view = "loading";
  else if (error && !snapshot) view = "error";
  else view = "ready";

  return {
    configured,
    signedIn: Boolean(user),
    view,
    snapshot,
    error,
    loading,
    reload,
  };
}
