"use client";

import { competitionToIcs, downloadIcs } from "@/lib/ics";
import type { Competition } from "@/lib/types";

export function AddToCalendarButton({
  comp,
  compact = false,
  className = "",
}: {
  comp: Competition;
  /** Card-sized padding and a shorter label. Same pastel-red control as Details. */
  compact?: boolean;
  className?: string;
}) {
  const label = compact ? "Add to calendar" : "Add dates to calendar";
  return (
    <button
      type="button"
      onClick={() => downloadIcs(`${comp.id}.ics`, competitionToIcs(comp))}
      aria-label="Add dates to calendar"
      className={`inline-flex min-h-11 shrink-0 items-center rounded-control bg-accent font-bold text-foreground ${
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${className}`}
    >
      {label}
    </button>
  );
}
