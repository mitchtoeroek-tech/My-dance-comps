"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { ageAsAtCompYear } from "@/lib/age";
import { filterComps, resolveHomeState } from "@/lib/filter";
import type { Competition } from "@/lib/types";
import { CompCard } from "./CompCard";
import {
  ChildFilterNote,
  ChildPicker,
  HomeStateChips,
  InterstateToggle,
} from "./ChildPicker";
import { EmptyState } from "./EmptyState";
import { ErrorBoundary } from "./ErrorBoundary";
import { useLiveComps } from "@/hooks/useLiveComps";
import { formatDateTime } from "@/lib/datetime";

export function CompsView({ initialComps }: { initialComps: Competition[] }) {
  const {
    ready,
    selectedChild,
    state,
    toggleFavourite,
    isFavourite,
    setPreferredState,
  } = useFamily();
  const [query, setQuery] = useState("");
  const { comps: liveComps, refreshedAt, live } = useLiveComps(initialComps);

  const homeState = ready
    ? resolveHomeState(selectedChild, state.preferredState)
    : null;
  const includeInterstate = ready ? state.includeInterstate : false;
  const needsStatePrompt = ready && !homeState && !includeInterstate;
  const child = ready ? selectedChild : null;

  const comps = useMemo(
    () =>
      filterComps(liveComps, {
        query,
        includeInterstate,
        child,
        homeState,
      }),
    [liveComps, query, includeInterstate, child, homeState],
  );

  return (
    <div className="space-y-4">
      <ChildPicker />
      {!child ? (
        <HomeStateChips value={homeState} onChange={setPreferredState} />
      ) : null}
      <InterstateToggle homeState={homeState} />
      <label className="block">
        <span className="sr-only">Search competitions</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, suburb, style…"
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium"
        />
      </label>
      <ChildFilterNote
        child={child}
        homeState={homeState}
        includeInterstate={includeInterstate}
      />
      {!ready ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading your family…</p>
      ) : needsStatePrompt ? (
        <EmptyState
          title="Pick a home state"
          body="Choose a state chip above, or add a dancer with a home state. We won’t list every competition in Australia until you do — unless you turn on interstate comps."
          action={
            state.children.length === 0 ? (
              <Link
                href="/kids"
                className="inline-flex rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
              >
                Add a dancer
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {state.children.length === 0 ? (
            <p className="rounded-2xl bg-[var(--gold-soft)] px-3 py-2 text-xs font-semibold text-[var(--gold-ink)]">
              Add a dancer on the Kids tab to also filter this list by age (as
              at 1 January) and preferred styles.
            </p>
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
                        child && comp.startDate
                          ? `Age ${ageAsAtCompYear(child.dob, comp.startDate)} as at 1 Jan ${comp.startDate.slice(0, 4)}`
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
      {refreshedAt ? (
        <p className="text-center text-xs text-[var(--ink-soft)]">
          Listings last checked {formatDateTime(refreshedAt)}
          {live ? " from organiser websites." : " from saved seed data."}
        </p>
      ) : null}
    </div>
  );
}
