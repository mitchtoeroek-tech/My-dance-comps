"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { ageAsAtCompYear } from "@/lib/age";
import { selectEnrolledCalendarComps } from "@/lib/calendar";
import { compareCompsByDate } from "@/lib/filter";
import type { ChildProfile, Competition } from "@/lib/types";
import { CompCard } from "./CompCard";
import { DateSortControl, useCompsDateSort } from "./DateSortControl";
import { EmptyState } from "./EmptyState";
import { ErrorBoundary } from "./ErrorBoundary";
import { MonthCalendar } from "./MonthCalendar";
import { FriendsOnMyComps } from "./FriendsOnMyComps";
import { useLiveComps } from "@/hooks/useLiveComps";

export function MyCompsView({ initialComps }: { initialComps: Competition[] }) {
  const { account } = useAuth();
  const {
    ready,
    state,
    toggleEnrolled,
    isEnrolled,
    enrolledIdsFor,
  } = useFamily();
  const { comps: liveComps } = useLiveComps(initialComps);
  const { sortDir, setSortDir } = useCompsDateSort();
  const [filterChildId, setFilterChildId] = useState<string | null>(null);

  const children = Array.isArray(state.children) ? state.children : [];
  const selfOnly = account?.role === "dancer";
  const activeFilterId = selfOnly
    ? (children[0]?.id ?? null)
    : filterChildId && children.some((child) => child.id === filterChildId)
      ? filterChildId
      : null;
  const filterChild =
    children.find((child) => child.id === activeFilterId) ?? null;

  const enrolledIds = useMemo(() => {
    if (!ready) return [];
    return enrolledIdsFor(activeFilterId);
  }, [ready, enrolledIdsFor, activeFilterId]);

  const enrolledSet = useMemo(() => new Set(enrolledIds), [enrolledIds]);

  const comps = useMemo(() => {
    if (!ready) return [];
    return liveComps
      .filter((comp) => enrolledSet.has(comp.id))
      .sort((a, b) => compareCompsByDate(a, b, sortDir));
  }, [ready, liveComps, enrolledSet, sortDir]);

  const calendarComps = useMemo(
    () => (ready ? selectEnrolledCalendarComps(liveComps, enrolledIds) : []),
    [ready, liveComps, enrolledIds],
  );

  const isEnrolledForFilter = useCallback(
    (compId: string) => isEnrolled(compId, activeFilterId),
    [isEnrolled, activeFilterId],
  );
  const toggleEnrolledForFilter = useCallback(
    (compId: string) => toggleEnrolled(compId, activeFilterId),
    [toggleEnrolled, activeFilterId],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Comps</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {selfOnly
            ? "Competitions you have marked Enrolled. Friends who are accepted can see these when sharing is on."
            : "Competitions you have marked Enrolled. Filter by dancer, or choose All dancers to see every confirmed entry. When you are signed in, friends of that dancer see these enrolments automatically."}
        </p>
      </div>

      {selfOnly ? null : (
        <MyCompsChildFilter
          dancers={children}
          value={activeFilterId}
          onChange={setFilterChildId}
        />
      )}

      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading your family…</p>
      ) : (
        <>
          {comps.length === 0 ? (
            <MyCompsEmpty
              childrenCount={children.length}
              filterChild={filterChild}
              selfOnly={selfOnly}
            />
          ) : (
            <>
              <DateSortControl value={sortDir} onChange={setSortDir} />
              <ul className="space-y-3">
                {comps.map((comp) => (
                  <li key={comp.id}>
                    <ErrorBoundary>
                      <CompCard
                        comp={comp}
                        enrolled={isEnrolled(comp.id, activeFilterId)}
                        onToggleEnrolled={() =>
                          toggleEnrolled(comp.id, activeFilterId)
                        }
                        showAddToCalendar
                        ageHint={
                          filterChild && comp.startDate
                            ? `Age ${ageAsAtCompYear(filterChild.dob, comp.startDate)} as at 1 Jan ${comp.startDate.slice(0, 4)}`
                            : undefined
                        }
                      />
                    </ErrorBoundary>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div>
            <h2 className="text-lg font-bold">Calendar</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Enrolled comps only
              {filterChild
                ? ` for ${filterChild.name}`
                : children.length > 0
                  ? " for every dancer on this device"
                  : ""}
              . A star on a date means that day has an enrolled comp.
              Interstate entries stay visible, matching this list.
            </p>
          </div>
          <MonthCalendar
            comps={calendarComps}
            enrolledIds={enrolledIds}
            isEnrolled={isEnrolledForFilter}
            toggleEnrolled={toggleEnrolledForFilter}
            emptyMonth={({ monthTitle, hasAnyComps }) =>
              hasAnyComps ? (
                <EmptyState
                  title="Nothing enrolled this month"
                  body={`No enrolled dates in ${monthTitle}. Swipe or tap next to look at another month.`}
                />
              ) : null
            }
          />

          <FriendsOnMyComps
            filterChildId={activeFilterId}
            filterChild={filterChild}
          />
        </>
      )}
    </div>
  );
}

function MyCompsChildFilter({
  dancers,
  value,
  onChange,
}: {
  dancers: ChildProfile[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Filter enrolled comps by dancer"
    >
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={`min-h-11 shrink-0 rounded-control px-3 py-1.5 text-sm font-bold ${
          value === null
            ? "bg-primary text-white"
            : "bg-surface text-foreground ring-1 ring-border"
        }`}
      >
        All dancers
      </button>
      {dancers.map((child) => {
        const on = value === child.id;
        return (
          <button
            key={child.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(child.id)}
            className={`min-h-11 shrink-0 rounded-control px-3 py-1.5 text-sm font-bold ${
              on
                ? "bg-primary text-white"
                : "bg-surface text-foreground ring-1 ring-border"
            }`}
          >
            {child.name || "Dancer"}
          </button>
        );
      })}
    </div>
  );
}

function MyCompsEmpty({
  childrenCount,
  filterChild,
  selfOnly,
}: {
  childrenCount: number;
  filterChild: ChildProfile | null;
  selfOnly: boolean;
}) {
  if (filterChild) {
    return (
      <EmptyState
        title={`Nothing enrolled for ${filterChild.name} yet`}
        body={`Mark Enrolled on a competition to see it here. You can do that on the Comps tab with ${filterChild.name.split(" ")[0]} selected, or from a card on this list after choosing All dancers.`}
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Find comps
          </Link>
        }
      />
    );
  }

  if (childrenCount === 0) {
    return (
      <EmptyState
        title="No enrolled comps yet"
        body={
          selfOnly
            ? "Set up My Info if you like, then Mark Enrolled on a competition to see it here."
            : "Add a dancer on the My Dancers tab if you like, then Mark Enrolled on a competition to see it here."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/kids"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              {selfOnly ? "Set up My Info" : "Add a dancer"}
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
            >
              Find comps
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No enrolled comps yet"
      body="Mark Enrolled on a competition to see it here."
      action={
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Find comps
        </Link>
      }
    />
  );
}
