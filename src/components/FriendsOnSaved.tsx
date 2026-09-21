"use client";

import Link from "next/link";
import { ChildPicker } from "@/components/ChildPicker";
import { FriendCompsList } from "@/components/FriendCompsList";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useCompsDateSort } from "@/components/DateSortControl";
import { useFamily } from "@/context/FamilyContext";
import { useFriends } from "@/hooks/useFriends";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";

export function FriendsOnSaved() {
  const { selectedChild, state } = useFamily();
  const child = selectedChild ?? state.children[0] ?? null;
  const { view, snapshot, error } = useFriends(child?.id ?? null);
  const { comps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Friends’ comps</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Entered comps for the selected dancer’s friends. Same cards and date
            order as the main list.
          </p>
        </div>
        {child ? (
          <Link
            href={`/kids/${child.id}`}
            className="shrink-0 text-xs font-bold text-primary-ink underline"
          >
            Manage friends
          </Link>
        ) : null}
      </div>
      {state.children.length > 1 ? <ChildPicker /> : null}
      {view === "guest" || view === "unavailable" ? (
        <GuestFriendsUnlock nextPath="/saved" compact />
      ) : null}
      {view === "loading" ? (
        <p className="text-sm font-semibold text-muted-foreground">
          Loading friends’ comps…
        </p>
      ) : null}
      {view === "error" ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
      {view === "ready" && !child ? (
        <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          Add a dancer on Kids before you can add friends.
        </p>
      ) : null}
      {view === "ready" && child && snapshot ? (
        snapshot.friends.length === 0 ? (
          <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            {child.name} has no friends yet. Open their profile to share an
            invite.
          </p>
        ) : (
          <div className="space-y-4">
            {snapshot.incoming.length > 0 ? (
              <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold">
                {snapshot.incoming.length === 1
                  ? "1 friend request waiting."
                  : `${snapshot.incoming.length} friend requests waiting.`}{" "}
                <Link href={`/kids/${child.id}`} className="underline">
                  Review
                </Link>
              </p>
            ) : null}
            {snapshot.friends.map((friend) => (
              <div key={friend.friendshipId} className="space-y-2">
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
        )
      ) : null}
    </section>
  );
}
