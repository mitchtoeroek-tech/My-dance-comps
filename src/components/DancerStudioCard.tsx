"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioLinkField } from "@/components/StudioLinkField";
import { StudioLogo } from "@/components/StudioLogo";
import type { ApprovedStudioMark } from "@/lib/studios";

export function DancerStudioCard({
  childId,
  childName,
  studio,
  studioId,
  studioMark = null,
  canEdit,
  onSave,
}: {
  childId: string;
  childName: string;
  studio: string;
  studioId: string | null;
  studioMark?: ApprovedStudioMark | null;
  canEdit: boolean;
  onSave: (next: { studio: string; studioId: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(studioId);
  const [draftName, setDraftName] = useState(studio);
  const [saved, setSaved] = useState(false);
  const hasStudio = Boolean(studio.trim() || studioId);

  function openEditor() {
    setDraftId(studioId);
    setDraftName(studio);
    setSaved(false);
    setOpen(true);
  }

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div className="flex items-start gap-3">
        {studioMark ? (
          <StudioLogo name={studioMark.name} logoUrl={studioMark.logoUrl} />
        ) : null}
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Studio</h2>
          {hasStudio ? (
            studioId ? (
              <Link
                href={`/studios/${studioId}`}
                className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary-ink underline"
              >
                {studio || studioMark?.name || "View studio"}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-semibold">{studio}</p>
            )
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No studio yet for {childName}.
            </p>
          )}
        </div>
      </div>

      {saved && !open ? (
        <p className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-ink">
          Studio saved.
        </p>
      ) : null}

      {canEdit && open ? (
        <div className="space-y-3">
          <StudioLinkField
            key={`${childId}-${studioId ?? ""}-${studio}`}
            studioId={draftId}
            studioName={draftName}
            onChange={({ studioId: nextId, studioName }) => {
              setDraftId(nextId);
              setDraftName(studioName);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onSave({
                  studio: draftName.trim(),
                  studioId: draftId,
                });
                setOpen(false);
                setSaved(true);
              }}
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Save studio
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {canEdit && !open ? (
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
        >
          {hasStudio ? "Change studio" : "Link studio"}
        </button>
      ) : null}
    </section>
  );
}
