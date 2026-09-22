"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FriendCompsList } from "@/components/FriendCompsList";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useCompsDateSort } from "@/components/DateSortControl";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { useFriendsForChildren } from "@/hooks/useFriends";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";
import type { AcceptedFriend } from "@/lib/friends";
import type { ChildProfile } from "@/lib/types";

export function FriendsOnMyComps({
  filterChildId,
  filterChild,
}: {
  filterChildId: string | null;
  filterChild: ChildProfile | null;
}) {
  const { account } = useAuth();
  const { state } = useFamily();
  const children = Array.isArray(state.children) ? state.children : [];
  const targetIds = filterChildId
    ? [filterChildId]
    : children.map((child) => child.id);
  const bundle = useFriendsForChildren(targetIds);
  const { comps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();
  const reviewChild = filterChild ?? children[0] ?? null;

  const friends = useMemo(
    () => mergeAcceptedFriends(bundle.friends),
    [bundle.friends],
  );

  const view = bundle.view;
  const incomingCount = bundle.incomingCount;

  return (
    <section className="space-y-3 pb-8">
      <div>
        <h2 className="text-lg font-bold">Friends’ comps</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Competitions friends of
          {filterChild
            ? ` ${filterChild.name}`
            : children.length > 0
              ? " your dancers"
              : " your family"}{" "}
          have marked Enrolled. You only see the friend’s dancer name — not
          their parent’s account.
        </p>
      </div>

      {view === "guest" || view === "unavailable" ? (
        <GuestFriendsUnlock nextPath="/my-comps" compact />
      ) : null}

      {view === "loading" ? (
        <p className="text-sm font-semibold text-muted-foreground">
          Loading friends’ comps…
        </p>
      ) : null}

      {view === "error" ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {bundle.error}
        </p>
      ) : null}

      {view === "ready" && children.length === 0 ? (
        <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          {account?.role === "dancer"
            ? "Set up My Info, then add other dancers from your studio chat."
            : "Add a dancer on My Dancers. To add other parents, open your studio chat."}
        </p>
      ) : null}

      {view === "ready" && children.length > 0 ? (
        <>
          {incomingCount > 0 && reviewChild ? (
            <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold">
              {incomingCount === 1
                ? "1 friend request waiting."
                : `${incomingCount} friend requests waiting.`}{" "}
              <Link href={`/kids/${reviewChild.id}`} className="underline">
                Review
              </Link>
            </p>
          ) : null}

          {friends.length === 0 ? (
            <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
              No enrolled comps from dancer friends yet. Add people from your
              studio chat — parents add parents, dancers add dancers.
            </p>
          ) : (
            <div className="space-y-4">
              {friends.map((friend) => (
                <div key={friend.childId} className="space-y-2">
                  <h3 className="text-sm font-bold text-primary-ink">
                    {friend.name}
                  </h3>
                  <FriendCompsList
                    friendName={friend.name}
                    enrolledCompIds={friend.enrolledCompIds}
                    comps={comps}
                    sortDir={sortDir}
                  />
                </div>
              ))}
            </div>
          )}

          <Link
            href="/community"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Add friends in Community
          </Link>
        </>
      ) : null}
    </section>
  );
}

function mergeAcceptedFriends(friends: AcceptedFriend[]): AcceptedFriend[] {
  const map = new Map<string, AcceptedFriend>();
  for (const friend of friends) {
    const existing = map.get(friend.childId);
    if (!existing) {
      map.set(friend.childId, {
        ...friend,
        enrolledCompIds: [...friend.enrolledCompIds],
      });
      continue;
    }
    const ids = new Set(existing.enrolledCompIds);
    for (const id of friend.enrolledCompIds) ids.add(id);
    map.set(friend.childId, {
      ...existing,
      enrolledCompIds: Array.from(ids),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
