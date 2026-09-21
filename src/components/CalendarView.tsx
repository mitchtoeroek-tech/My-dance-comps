"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useLiveComps } from "@/hooks/useLiveComps";
import { selectCalendarComps } from "@/lib/calendar";
import { resolveHomeState } from "@/lib/filter";
import type { Competition } from "@/lib/types";
import {
  ChildFilterNote,
  ChildPicker,
  HomeStateChips,
  InterstateToggle,
  type LocationChip,
} from "./ChildPicker";
import { EmptyState } from "./EmptyState";
import { MonthCalendar } from "./MonthCalendar";

export function CalendarView({
  initialComps,
}: {
  initialComps: Competition[];
}) {
  const {
    ready,
    selectedChild,
    state,
    setPreferredState,
    setSelectedChildId,
    setIncludeInterstate,
    isEnrolled,
    toggleEnrolled,
    isFavourite,
    enrolledIdsFor,
  } = useFamily();
  const { comps: liveComps } = useLiveComps(initialComps);

  const homeState = ready
    ? resolveHomeState(selectedChild, state.preferredState)
    : null;
  const includeInterstate = ready ? state.includeInterstate : false;
  const child = ready ? selectedChild : null;
  const enrolledIds = useMemo(
    () => (ready ? enrolledIdsFor() : []),
    [ready, enrolledIdsFor],
  );

  const calendarComps = useMemo(
    () =>
      ready
        ? selectCalendarComps(liveComps, {
            filters: {
              query: "",
              includeInterstate,
              child,
              homeState,
            },
          })
        : [],
    [ready, liveComps, includeInterstate, child, homeState],
  );

  const locationChip: LocationChip | null = includeInterstate
    ? "ALL"
    : homeState;

  const onSelectLocation = (next: LocationChip) => {
    if (next === "ALL") {
      setIncludeInterstate(true);
      return;
    }
    setIncludeInterstate(false);
    setPreferredState(next);
    if (selectedChild && selectedChild.homeState !== next) {
      setSelectedChildId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Dates for the selected state (plus National finals), matching the
          Comps list. Tap SA, Vic, NSW, or All to update the month immediately.
          Dots use the same entry-status colours as Comps. Enrolled comps in
          this filter get a star.
        </p>
      </div>

      <ChildPicker />
      <HomeStateChips
        showAll
        value={locationChip}
        onChange={onSelectLocation}
      />
      <InterstateToggle homeState={homeState} />
      <ChildFilterNote
        child={child}
        homeState={homeState}
        includeInterstate={includeInterstate}
      />

      <MonthCalendar
        comps={calendarComps}
        enrolledIds={enrolledIds}
        isEnrolled={isEnrolled}
        toggleEnrolled={toggleEnrolled}
        isFavourite={isFavourite}
        emptyState={
          !ready ? (
            <p className="text-sm text-muted-foreground">Loading your family…</p>
          ) : calendarComps.length === 0 ? (
            <EmptyState
              title="Nothing on this calendar yet"
              body={
                homeState || includeInterstate
                  ? "No matching dates for this state. Try All, another state chip, or a different month."
                  : "Pick a state chip (or All) so we can show dates instead of every event in Australia."
              }
              action={
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  Find comps
                </Link>
              }
            />
          ) : null
        }
      />
    </div>
  );
}
