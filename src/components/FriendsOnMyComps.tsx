"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AddFriendCard } from "@/components/AddFriendCard";
import { FriendCompsList } from "@/components/FriendCompsList";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useCompsDateSort } from "@/components/DateSortControl";
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
  const { state } = useFamily();
  const children = Array.isArray(state.children) ? state.children : [];
  const targetIds = filterChildId
    ? [filterChildId]
    : children.map((child) => child.id);
  const bundle = useFriendsForChildren(targetIds);
  const { comps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();
  const [addForId, setAddForId] = useState<string | null>(null);

  const addChild =
    children.find(
      (child) => child.id === (filterChildId ?? addForId ?? children[0]?.id),
    ) ?? null;

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
          Add a dancer on My Dancers, then you can add friends by email.
        </p>
      ) : null}

      {view === "ready" && children.length > 0 ? (
        <>
          {incomingCount > 0 && addChild ? (
            <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold">
              {incomingCount === 1
                ? "1 friend request waiting."
                : `${incomingCount} friend requests waiting.`}{" "}
              <Link href={`/kids/${addChild.id}`} className="underline">
                Review
              </Link>
            </p>
          ) : null}

          {friends.length === 0 ? (
            <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
              {filterChild
                ? `${filterChild.name} has no friends yet. Add one by the other parent’s email below.`
                : "No friends yet. Pick which of your dancers this is for, then add a friend by email."}
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

          {children.length > 1 && !filterChildId ? (
            <label className="block text-sm font-bold" htmlFor="add-friend-for">
              This friend is for
              <select
                id="add-friend-for"
                value={addChild?.id ?? ""}
                onChange={(event) => setAddForId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-3 text-sm font-medium"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {addChild ? (
            <AddFriendCard
              fromChildId={addChild.id}
              fromChildName={addChild.name}
              busy={bundle.loading}
              onSent={bundle.reload}
            />
          ) : null}

          {addChild ? (
            <p className="text-xs font-semibold text-muted-foreground">
              Need the invite link?{" "}
              <Link href={`/kids/${addChild.id}`} className="text-primary-ink underline">
                Manage friends for {addChild.name}
              </Link>
            </p>
          ) : null}
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
