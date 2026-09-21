"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChildForm } from "@/components/ChildForm";
import { EmptyState } from "@/components/EmptyState";
import { useFamily } from "@/context/FamilyContext";
import { displayAge } from "@/lib/age";
import { myDancersLabel } from "@/lib/copy";
import { SOFT_MAX_KIDS } from "@/lib/storage";

export default function KidsPage() {
  const { state, canAddChild, upsertChild, setSelectedChildId } = useFamily();
  const [showForm, setShowForm] = useState(false);
  const heading = myDancersLabel(state.children.length);

  useEffect(() => {
    document.title = `${heading} · My Dance Comps`;
  }, [heading]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {state.children.length} of {SOFT_MAX_KIDS} dancer profiles. They
            stay on this device; sign in from Account to sync. Open a dancer to
            share a friend invite.
          </p>
        </div>
        {canAddChild ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Add a dancer
          </button>
        ) : (
          <p className="max-w-36 text-right text-xs font-semibold text-muted-foreground">
            Soft limit of {SOFT_MAX_KIDS} reached
          </p>
        )}
      </div>
      {showForm && canAddChild ? (
        <ChildForm
          onSubmit={(child) => {
            const id = upsertChild(child);
            setShowForm(false);
            if (id) setSelectedChildId(id);
          }}
          onCancel={() => setShowForm(false)}
          submitLabel="Add a dancer"
        />
      ) : null}
      {state.children.length === 0 && !showForm ? (
        <EmptyState
          title="No dancers yet"
          body="Add each dancer with date of birth, preferred styles, studio and home state. There is no hard limit of two — families can keep going up to about 20."
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Add a dancer
            </button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {state.children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/kids/${child.id}`}
                className="block rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
                onClick={() => setSelectedChildId(child.id)}
              >
                <p className="text-lg font-bold">{child.name}</p>
                <p className="text-sm text-muted-foreground">
                  {displayAge(child.dob)} · {child.homeState}
                  {child.studio ? ` · ${child.studio}` : ""}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary-ink">
                  {child.styles?.length
                    ? child.styles.join(" · ")
                    : "All styles"}
                </p>
                <p className="mt-2 text-xs font-bold text-primary-ink">
                  Friends and invite →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
