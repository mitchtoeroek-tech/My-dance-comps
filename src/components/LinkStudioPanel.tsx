"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { loginPathWithNext } from "@/lib/friends";
import {
  isLinkedToStudio,
  planStudioLink,
  studioLinkedLabel,
  withStudioLink,
  withoutStudioLink,
} from "@/lib/studio-link";
import type { ChildProfile } from "@/lib/types";

const primaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2.5 text-center text-sm font-bold text-white";

export function LinkStudioPanel({
  studioId,
  studioName,
  returnPath,
}: {
  studioId: string;
  studioName: string;
  returnPath: string;
}) {
  const { user, ready: authReady, account, accountReady } = useAuth();
  const { state, ready: familyReady, upsertChild } = useFamily();
  const [choosing, setChoosing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const signedIn = Boolean(user);
  const waiting =
    !authReady ||
    (signedIn && !accountReady) ||
    (signedIn && account?.role !== "studio" && !familyReady);

  if (waiting) {
    return (
      <p className="text-sm font-semibold text-muted-foreground">Loading…</p>
    );
  }

  const plan = planStudioLink({
    signedIn,
    role: account?.role,
    children: state.children,
    linkedChildId: account?.linkedChildId,
    selectedChildId: state.selectedChildId,
  });

  if (plan.kind === "studio") return null;

  if (plan.kind === "guest") {
    return (
      <div className="space-y-2">
        <Link href={loginPathWithNext(returnPath)} className={primaryButton}>
          Link this studio
        </Link>
        <p className="text-sm leading-5 text-muted-foreground">
          Log in to link a dancer to this studio.
        </p>
      </div>
    );
  }

  if (plan.kind === "needs-profile") {
    const dancer = plan.role === "dancer";
    return (
      <div className="space-y-2">
        <Link href="/kids" className={primaryButton}>
          {dancer ? "Set up your profile" : "Add a dancer"}
        </Link>
        <p className="text-sm leading-5 text-muted-foreground">
          {dancer
            ? "Set up your dancer profile, then you can link this studio."
            : "Add a dancer, then you can link them to this studio."}
        </p>
      </div>
    );
  }

  const single = plan.dancers.length === 1;
  const linked = plan.dancers.filter((child) => isLinkedToStudio(child, studioId));
  const unlinked = plan.dancers.filter((child) => !isLinkedToStudio(child, studioId));
  const only = unlinked[0];

  function linkDancer(child: ChildProfile) {
    upsertChild(withStudioLink(child, { id: studioId, name: studioName }));
    setAnnouncement(studioLinkedLabel(studioName, single ? undefined : child.name));
  }

  function removeLink(child: ChildProfile) {
    upsertChild(withoutStudioLink(child, studioId));
    setAnnouncement(
      `Removed the link to ${studioName.trim() || "this studio"}.`,
    );
    setChoosing(false);
  }

  return (
    <div className="space-y-2">
      {linked.map((child) => {
        const label = studioLinkedLabel(studioName, single ? undefined : child.name);
        return (
          <div
            key={child.id}
            className="flex items-center justify-between gap-2 rounded-control bg-primary-soft px-3 py-2"
          >
            <p
              className="min-w-0 text-sm font-bold text-foreground"
              role={announcement === label ? "status" : undefined}
            >
              {label}
            </p>
            <button
              type="button"
              onClick={() => removeLink(child)}
              className="min-h-11 shrink-0 text-sm font-bold text-primary-ink underline"
              aria-label={`Remove ${child.name} from ${studioName}`}
            >
              Remove
            </button>
          </div>
        );
      })}
      {unlinked.length === 0 ? null : single && only ? (
        <div className="space-y-1">
          <button type="button" onClick={() => linkDancer(only)} className={primaryButton}>
            Link this studio
          </button>
          <p className="text-sm leading-5 text-muted-foreground">
            {account?.role === "dancer" ? "Links your profile." : `Links ${only.name}.`}
          </p>
        </div>
      ) : choosing ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">Choose a dancer</p>
          <ul className="space-y-2" aria-label="Choose a dancer">
            {unlinked.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => linkDancer(child)}
                  className="flex min-h-11 w-full flex-col items-start justify-center rounded-control bg-surface px-3 py-2 text-left ring-1 ring-border"
                >
                  <span className="text-sm font-bold text-foreground">{child.name}</span>
                  {child.studio ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      Currently {child.studio}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" onClick={() => setChoosing(true)} className={primaryButton}>
          Link this studio
        </button>
      )}
      {announcement.startsWith("Removed") ? (
        <p className="text-sm font-semibold text-primary-ink" role="status">
          {announcement}
        </p>
      ) : null}
    </div>
  );
}
