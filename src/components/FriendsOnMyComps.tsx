"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FriendCompsList } from "@/components/FriendCompsList";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useCompsDateSort } from "@/components/DateSortControl";
import { useStudioFriends } from "@/hooks/useFriends";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";
import { enrolledDancersFromDirectory } from "@/lib/friends";
import type { ChildProfile } from "@/lib/types";

export function FriendsOnMyComps({
  filterChildId,
  filterChild,
}: {
  filterChildId: string | null;
  filterChild: ChildProfile | null;
}) {
  const bundle = useStudioFriends();
  const { comps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();
  const studioId = filterChild?.studioId ?? null;

  const friends = useMemo(
    () => enrolledDancersFromDirectory(bundle.directory ?? { role: "none", studios: [] }, studioId),
    [bundle.directory, studioId],
  );

  const view = bundle.view;

  return (
    <section className="space-y-3 pb-8">
      <div>
        <h2 className="text-lg font-bold">Friends’ comps</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Competitions accepted friends
          {filterChild ? ` at ${filterChild.studio || "this studio"}` : ""} have
          marked Enrolled. You see the dancer’s name — not an email address.
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

      {view === "ready" && !studioId && filterChildId ? (
        <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          Link {filterChild?.name ?? "this dancer"} to a studio to see friends’
          comps from that studio.
        </p>
      ) : null}

      {view === "ready" && (!filterChildId || studioId) ? (
        <>
          {friends.length === 0 ? (
            <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
              No enrolled comps from friends yet. Add someone from Friends at
              your studio.
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
          <p className="text-xs font-semibold text-muted-foreground">
            <Link href={filterChildId ? `/kids/${filterChildId}` : "/kids"} className="text-primary-ink underline">
              Manage friends at your studio
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
