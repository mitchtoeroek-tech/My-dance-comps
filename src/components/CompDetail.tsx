"use client";

import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { formatCompLocation, registrationStatus } from "@/lib/comps";
import { formatDateRange, formatDateTime } from "@/lib/datetime";
import { competitionToIcs, downloadIcs } from "@/lib/ics";
import type { Competition } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { StarButton } from "./StarButton";
import { EnrolledButton } from "./EnrolledButton";

export function CompDetail({ comp }: { comp: Competition }) {
  const { isFavourite, toggleFavourite, isEnrolled, toggleEnrolled } =
    useFamily();
  const saved = isFavourite(comp.id);
  const enrolled = isEnrolled(comp.id);
  const status = registrationStatus(comp);

  return (
    <article className="space-y-4">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink hover:underline"
      >
        ← All comps
      </Link>
      <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill status={status} />
              <span className="rounded-control bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
                {comp.isNational ? "National" : comp.state}
              </span>
              <span className="rounded-control bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-foreground">
                {comp.kind}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight text-foreground">
              {comp.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {formatDateRange(comp.startDate, comp.endDate)}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1.5">
            <EnrolledButton
              enrolled={enrolled}
              onClick={() => toggleEnrolled(comp.id)}
            />
            <StarButton saved={saved} onClick={() => toggleFavourite(comp.id)} />
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Venue" value={formatCompLocation(comp)} />
          <Row
            label="Organiser"
            value={
              <a
                className="font-semibold text-primary-ink underline"
                href={comp.organiserUrl}
                target="_blank"
                rel="noreferrer"
              >
                {comp.organiser}
              </a>
            }
          />
          <Row
            label="Entries open"
            value={formatDateTime(comp.registrationOpens)}
          />
          <Row
            label="Entries close"
            value={formatDateTime(comp.registrationCloses)}
          />
          <Row
            label="Age range"
            value={
              comp.minAge == null && comp.maxAge == null
                ? "Check organiser"
                : `${comp.minAge ?? "any"}–${comp.maxAge ?? "open"} years as at 1 January`
            }
          />
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Array.isArray(comp.styles) ? comp.styles : []).map((style) => (
            <span
              key={style}
              className="rounded-control bg-muted px-2 py-0.5 text-[11px] font-semibold"
            >
              {style}
            </span>
          ))}
        </div>
        {comp.notes ? (
          <p className="mt-3 text-sm leading-6 text-foreground">{comp.notes}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={comp.registrationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Registration link
          </a>
          <a
            href={comp.infoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border"
          >
            Organiser info
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(`${comp.id}.ics`, competitionToIcs(comp))}
            className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 py-2 text-sm font-bold text-foreground"
          >
            Add dates to calendar
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap Enrolled to store a confirmed entry on this device (same
          localStorage family list as favourites). That date then shows a star
          on the Calendar tab. Saving a comp adds it to Reminders. Always
          confirm dates on the organiser website.
        </p>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
