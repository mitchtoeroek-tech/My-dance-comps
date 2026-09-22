"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChildForm } from "@/components/ChildForm";
import { EmptyState } from "@/components/EmptyState";
import { FamilyPanel } from "@/components/FamilyPanel";
import { ResultLog } from "@/components/ResultLog";
import { StudioLogo } from "@/components/StudioLogo";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import {
  studioMarkFor,
  useApprovedStudioMarks,
} from "@/hooks/useApprovedStudioMarks";
import { displayAge } from "@/lib/age";
import { kidsSectionLabel } from "@/lib/copy";
import { SOFT_MAX_KIDS } from "@/lib/storage";
import type { ChildProfile } from "@/lib/types";

export default function KidsPage() {
  const { account } = useAuth();
  const parent = account?.role === "parent";
  const { state, canAddChild, upsertChild, setSelectedChildId } = useFamily();
  const [showForm, setShowForm] = useState(false);
  const dancer = account?.role === "dancer";
  const dancerChild =
    state.children.find((child) => child.id === account?.linkedChildId) ??
    (dancer ? state.children[0] : undefined);
  const heading = kidsSectionLabel(account?.role, state.children.length);
  const studioMarks = useApprovedStudioMarks(
    state.children.map((child) => child.studioId),
  );
  const hasDancers = state.children.length > 0;
  const familyAfterCards = hasDancers && account?.role !== "dancer";

  useEffect(() => {
    document.title = `${heading} · My Dance Comps`;
  }, [heading]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {dancer
              ? "This is your info. Comps and My Comps use it. Join a family from Account if a parent should see you too."
              : `${state.children.length} of ${SOFT_MAX_KIDS} dancer profiles. They stay on this device until you sign in. Open a dancer to invite their own login, link a studio, or share a friend invite.`}
          </p>
        </div>
        {canAddChild ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {dancer ? "Set up My Info" : "Add a dancer"}
          </button>
        ) : dancer ? null : (
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
          submitLabel={dancer ? "Save My Info" : "Add a dancer"}
        />
      ) : null}
      {familyAfterCards ? null : <FamilyPanel />}
      {state.children.length === 0 && !showForm ? (
        <EmptyState
          title={dancer ? "No info yet" : "No dancers yet"}
          body={
            dancer
              ? "Add your name, date of birth, styles, studio and home state. Then comps can filter for you."
              : "Add each dancer with date of birth, preferred styles, studio and home state. There is no hard limit of two — families can keep going up to about 20."
          }
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              {dancer ? "Set up My Info" : "Add a dancer"}
            </button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {state.children.map((child) => {
            const studioMark = studioMarkFor(studioMarks, child.studioId);
            return (
              <li key={child.id}>
                <Link
                  href={`/kids/${child.id}`}
                  className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
                  onClick={() => setSelectedChildId(child.id)}
                >
                  {studioMark ? (
                    <StudioLogo
                      name={studioMark.name}
                      logoUrl={studioMark.logoUrl}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
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
                      {dancerCardHint(child, {
                        dancer,
                        parent,
                        resultCount: state.results.filter(
                          (result) => result.childId === child.id,
                        ).length,
                      })}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {dancer && dancerChild ? <ResultLog childId={dancerChild.id} /> : null}
      {familyAfterCards ? <FamilyPanel /> : null}
    </div>
  );
}

function dancerCardHint(
  child: ChildProfile,
  viewer: { dancer: boolean; parent: boolean; resultCount: number },
): string {
  const bits: string[] = [];
  if (viewer.parent) {
    bits.push(child.linkedUserId ? "Own login" : "Invite login");
  }
  if (!child.studio && !child.studioId) bits.push("Link studio");
  bits.push(viewer.resultCount === 1 ? "1 result" : `${viewer.resultCount} results`);
  bits.push("Friends →");
  return bits.join(" · ");
}
