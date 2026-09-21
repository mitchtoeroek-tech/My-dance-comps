"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  loadFriendsForChild,
  type FriendsSnapshot,
  type AcceptedFriend,
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

export function useFriendsForChildren(childIds: string[]) {
  const { configured, ready: authReady, user } = useAuth();
  const key = childIds.join("|");
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    generation: number;
    friends: AcceptedFriend[];
    incomingCount: number;
    error: string | null;
  } | null>(null);

  const reload = useCallback(() => {
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!authReady || !configured || !user) return;
    const ids = key.split("|").filter(Boolean);
    const gen = generation;
    if (ids.length === 0) {
      setResult({
        key,
        generation: gen,
        friends: [],
        incomingCount: 0,
        error: null,
      });
      return;
    }
    let cancelled = false;
    void Promise.all(ids.map((id) => loadFriendsForChild(id))).then((rows) => {
      if (cancelled) return;
      const friends: AcceptedFriend[] = [];
      let incomingCount = 0;
      let error: string | null = null;
      for (const row of rows) {
        if (row.error && !error) error = row.error;
        if (!row.snapshot) continue;
        friends.push(...row.snapshot.friends);
        incomingCount += row.snapshot.incoming.length;
      }
      setResult({
        key,
        generation: gen,
        friends,
        incomingCount,
        error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, key, generation]);

  const matched = result && result.key === key ? result : null;
  const loading = Boolean(user && (!matched || matched.generation !== generation));

  let view: FriendsViewState = "loading";
  if (!authReady) view = "loading";
  else if (!configured) view = "unavailable";
  else if (!user) view = "guest";
  else if (loading && !matched) view = "loading";
  else if (matched?.error && matched.friends.length === 0) view = "error";
  else view = "ready";

  return {
    view,
    friends: matched?.friends ?? [],
    incomingCount: matched?.incomingCount ?? 0,
    error: matched?.error ?? null,
    loading,
    reload,
  };
}
