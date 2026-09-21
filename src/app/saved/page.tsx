"use client";

import Link from "next/link";
import { CompCard } from "@/components/CompCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FriendsOnSaved } from "@/components/FriendsOnSaved";
import { useFamily } from "@/context/FamilyContext";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";
import { friendEnrolledComps } from "@/lib/friends";
import { useCompsDateSort } from "@/components/DateSortControl";

export default function SavedPage() {
  const { state, toggleFavourite, isFavourite, toggleEnrolled, isEnrolled } =
    useFamily();
  const { comps: allComps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();
  const saved = allComps.filter((comp) => state.favourites.includes(comp.id));
  const entered = friendEnrolledComps(allComps, state.enrolled, sortDir);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My comps</h1>
        <p className="text-sm text-muted-foreground">
          Favourites stay on this device. Sign in from Account if you want them
          synced. Star a comp for reminders, or tap <strong>Mark as entered</strong>{" "}
          when you have confirmed a spot.
        </p>
        {saved.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the star on a competition to keep it here."
            action={
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Find comps
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {saved.map((comp) => (
              <li key={comp.id}>
                <ErrorBoundary>
                  <CompCard
                    comp={comp}
                    saved={isFavourite(comp.id)}
                    onToggleSave={() => toggleFavourite(comp.id)}
                    enrolled={isEnrolled(comp.id)}
                    onToggleEnrolled={() => toggleEnrolled(comp.id)}
                  />
                </ErrorBoundary>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Entered</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Comps this family marked as entered. Friends only see this list — not
          your stars.
        </p>
        {entered.length === 0 ? (
          <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            Nothing marked as entered yet. On a comp card, tap{" "}
            <strong>Mark as entered</strong>.
          </p>
        ) : (
          <ul className="space-y-3">
            {entered.map((comp) => (
              <li key={comp.id}>
                <ErrorBoundary>
                  <CompCard
                    comp={comp}
                    saved={isFavourite(comp.id)}
                    onToggleSave={() => toggleFavourite(comp.id)}
                    enrolled={isEnrolled(comp.id)}
                    onToggleEnrolled={() => toggleEnrolled(comp.id)}
                  />
                </ErrorBoundary>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FriendsOnSaved />
    </div>
  );
}
