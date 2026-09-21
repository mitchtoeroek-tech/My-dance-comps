"use client";

import Link from "next/link";
import { CompCard } from "@/components/CompCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useFamily } from "@/context/FamilyContext";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";

export default function SavedPage() {
  const { state, toggleFavourite, isFavourite, toggleEnrolled, isEnrolled } =
    useFamily();
  const { comps: allComps } = useLiveComps(getComps());
  const comps = allComps.filter((comp) => state.favourites.includes(comp.id));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Saved</h1>
      <p className="text-sm text-muted-foreground">
        Favourites stay on this device in local storage. Star a comp to include
        it in registration reminders.
      </p>
      {comps.length === 0 ? (
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
          {comps.map((comp) => (
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
  );
}
