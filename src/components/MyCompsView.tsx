"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { ageAsAtCompYear } from "@/lib/age";
import { compareCompsByDate } from "@/lib/filter";
import type { ChildProfile, Competition } from "@/lib/types";
import { CompCard } from "./CompCard";
import { DateSortControl, useCompsDateSort } from "./DateSortControl";
import { EmptyState } from "./EmptyState";
import { ErrorBoundary } from "./ErrorBoundary";
import { useLiveComps } from "@/hooks/useLiveComps";

export function MyCompsView({ initialComps }: { initialComps: Competition[] }) {
  const {
    ready,
    state,
    toggleFavourite,
    isFavourite,
    toggleEnrolled,
    isEnrolled,
    enrolledIdsFor,
  } = useFamily();
  const { comps: liveComps } = useLiveComps(initialComps);
  const { sortDir, setSortDir } = useCompsDateSort();
  const [filterChildId, setFilterChildId] = useState<string | null>(null);

  const children = Array.isArray(state.children) ? state.children : [];
  const activeFilterId =
    filterChildId && children.some((child) => child.id === filterChildId)
      ? filterChildId
      : null;
  const filterChild =
    children.find((child) => child.id === activeFilterId) ?? null;

  const enrolledSet = useMemo(() => {
    if (!ready) return new Set<string>();
    return new Set(enrolledIdsFor(activeFilterId));
  }, [ready, enrolledIdsFor, activeFilterId]);

  const comps = useMemo(() => {
    if (!ready) return [];
    return liveComps
      .filter((comp) => enrolledSet.has(comp.id))
      .sort((a, b) => compareCompsByDate(a, b, sortDir));
  }, [ready, liveComps, enrolledSet, sortDir]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Comps</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Competitions you have marked Enrolled. Filter by dancer, or choose
          All children to see every confirmed entry on this device.
        </p>
      </div>

      <MyCompsChildFilter
        dancers={children}
        value={activeFilterId}
        onChange={setFilterChildId}
      />

      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading your family…</p>
      ) : (
        <>
          <DateSortControl value={sortDir} onChange={setSortDir} />
          {comps.length === 0 ? (
            <MyCompsEmpty
              childrenCount={children.length}
              filterChild={filterChild}
            />
          ) : (
            <ul className="space-y-3">
              {comps.map((comp) => (
                <li key={comp.id}>
                  <ErrorBoundary>
                    <CompCard
                      comp={comp}
                      saved={isFavourite(comp.id)}
                      onToggleSave={() => toggleFavourite(comp.id)}
                      enrolled={isEnrolled(comp.id, activeFilterId)}
                      onToggleEnrolled={() =>
                        toggleEnrolled(comp.id, activeFilterId)
                      }
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
          )}
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
      aria-label="Filter enrolled comps by child"
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
        All children
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
}: {
  childrenCount: number;
  filterChild: ChildProfile | null;
}) {
  if (filterChild) {
    return (
      <EmptyState
        title={`Nothing enrolled for ${filterChild.name} yet`}
        body={`Mark Enrolled on a competition to see it here. You can do that on the Comps tab with ${filterChild.name.split(" ")[0]} selected, or from a card on this list after choosing All children.`}
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
        body="Add a dancer on the Kids tab if you like, then Mark Enrolled on a competition to see it here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/kids"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Add a dancer
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
