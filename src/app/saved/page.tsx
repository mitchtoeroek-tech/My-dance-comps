"use client";

import Link from "next/link";
import { CompCard } from "@/components/CompCard";
import { EmptyState } from "@/components/EmptyState";
import { useFamily } from "@/context/FamilyContext";
import { getComps } from "@/lib/comps";

export default function SavedPage() {
  const { state, toggleFavourite, isFavourite } = useFamily();
  const comps = getComps().filter((comp) => state.favourites.includes(comp.id));

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Saved
      </h1>
      <p className="text-sm text-[var(--ink-soft)]">
        Favourites stay on this device in local storage. Star a comp to include
        it in registration reminders.
      </p>
      {comps.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the gold star on a competition to keep it here."
          action={
            <Link
              href="/"
              className="inline-flex rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
            >
              Find comps
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {comps.map((comp) => (
            <li key={comp.id}>
              <CompCard
                comp={comp}
                saved={isFavourite(comp.id)}
                onToggleSave={() => toggleFavourite(comp.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
