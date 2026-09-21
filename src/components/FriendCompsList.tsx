"use client";

import { CompCard } from "@/components/CompCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { friendEnrolledComps } from "@/lib/friends";
import type { Competition } from "@/lib/types";
import type { DateSortDir } from "@/lib/filter";

export function FriendCompsList({
  friendName,
  enrolledCompIds,
  comps,
  sortDir = "asc",
  emptyLabel,
}: {
  friendName: string;
  enrolledCompIds: string[];
  comps: Competition[];
  sortDir?: DateSortDir;
  emptyLabel?: string;
}) {
  const listed = friendEnrolledComps(comps, enrolledCompIds, sortDir);

  if (listed.length === 0) {
    return (
      <p className="rounded-control bg-muted px-3 py-3 text-sm leading-6 text-muted-foreground">
        {emptyLabel ??
          `${friendName} has not marked any comps Enrolled yet.`}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {listed.map((comp) => (
        <li key={comp.id}>
          <ErrorBoundary>
            <CompCard
              comp={comp}
              enrolled
              eyebrow={`Enrolled: ${friendName}`}
            />
          </ErrorBoundary>
        </li>
      ))}
    </ul>
  );
}
