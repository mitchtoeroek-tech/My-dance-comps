"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  loadStudioFriends,
  type StudioFriendsDirectory,
} from "@/lib/friends";

export type FriendsViewState =
  | "guest"
  | "unavailable"
  | "loading"
  | "ready"
  | "error";

const FRIENDS_POLL_MS = 15_000;

export function useStudioFriends() {
  const { configured, ready: authReady, user } = useAuth();
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    generation: number;
    directory: StudioFriendsDirectory | null;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const gen = generation;
    let cancelled = false;
    void loadStudioFriends().then((next) => {
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
  }, [authReady, configured, user, generation]);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const timer = window.setInterval(() => {
      setGeneration((value) => value + 1);
    }, FRIENDS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [authReady, configured, user]);

  const directory = result?.directory ?? null;
  const error = result?.error ?? null;
  const loading = Boolean(
    user && (!result || result.generation !== generation),
  );

  let view: FriendsViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (loading && !directory) view = "loading";
  else if (error && !directory) view = "error";
  else view = "ready";

  return {
    configured,
    signedIn: Boolean(user),
    view,
    directory,
    error,
    loading,
    reload,
  };
}
