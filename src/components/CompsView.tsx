"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { ageAsAtCompYear } from "@/lib/age";
import { filterComps } from "@/lib/filter";
import type { Competition } from "@/lib/types";
import { CompCard } from "./CompCard";
import {
  ChildFilterNote,
  ChildPicker,
  InterstateToggle,
} from "./ChildPicker";
import { EmptyState } from "./EmptyState";
import { ErrorBoundary } from "./ErrorBoundary";
import { useLiveComps } from "@/hooks/useLiveComps";
import { formatDateTime } from "@/lib/datetime";

export function CompsView({ initialComps }: { initialComps: Competition[] }) {
  const { ready, selectedChild, state, toggleFavourite, isFavourite } =
    useFamily();
  const [query, setQuery] = useState("");
  const { comps: liveComps, refreshedAt, live } = useLiveComps(initialComps);

  const comps = useMemo(
    () =>
      filterComps(liveComps, {
        query,
        includeInterstate: ready ? state.includeInterstate : false,
        child: ready ? selectedChild : null,
      }),
    [liveComps, query, selectedChild, state.includeInterstate, ready],
  );

  return (
    <div className="space-y-4">
      <ChildPicker />
      <InterstateToggle />
      <label className="block">
        <span className="sr-only">Search competitions</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, suburb, style…"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium"
        />
      </label>
      <ChildFilterNote child={selectedChild} />
      {!ready ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading your family…</p>
      ) : null}
      {state.children.length === 0 ? (
        <EmptyState
          title="Add your dancers"
          body="Create a child profile with date of birth, styles, studio and home state. We’ll then show home-state comps plus nationals that fit their age as at 1 January."
          action={
            <Link
              href="/kids"
              className="inline-flex rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
            >
              Go to Kids
            </Link>
          }
        />
      ) : null}
      {comps.length === 0 ? (
        <EmptyState
          title="No matching comps"
          body="Try including interstate events, clearing the search, or adding more preferred styles."
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
                  ageHint={
                    ready && selectedChild && comp.startDate
                      ? `Age ${ageAsAtCompYear(selectedChild.dob, comp.startDate)} as at 1 Jan ${comp.startDate.slice(0, 4)}`
                      : undefined
                  }
                />
              </ErrorBoundary>
            </li>
          ))}
        </ul>
      )}
      {refreshedAt ? (
        <p className="text-center text-xs text-[var(--ink-soft)]">
          Listings last checked {formatDateTime(refreshedAt)}
          {live ? " from organiser websites." : " from saved seed data."}
        </p>
      ) : null}
    </div>
  );
}
