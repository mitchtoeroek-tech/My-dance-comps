"use client";

import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { formatCompLocation, registrationStatus } from "@/lib/comps";
import { formatDateRange, formatDateTime } from "@/lib/datetime";
import { canReviewCompetition } from "@/lib/reviews";
import type { Competition } from "@/lib/types";
import { AddToCalendarButton } from "./AddToCalendarButton";
import { StatusPill } from "./StatusPill";
import { EnrolledButton } from "./EnrolledButton";
import { CompReviewSection } from "./CompReviewSection";
import { CompReviewSummary } from "./CompReviewSummary";
import { ErrorBoundary } from "./ErrorBoundary";

export function CompDetail({ comp }: { comp: Competition }) {
  const { isEnrolled, toggleEnrolled } = useFamily();
  const enrolled = isEnrolled(comp.id);
  const status = registrationStatus(comp);
  const completed = canReviewCompetition(comp);

  return (
    <article className="space-y-4">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink hover:underline"
      >
        ← All comps
      </Link>
      <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="min-w-0">
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
            {completed ? <CompReviewSummary competitionId={comp.id} /> : null}
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
          <AddToCalendarButton comp={comp} />
          <EnrolledButton
            enrolled={enrolled}
            onClick={() => toggleEnrolled(comp.id)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap Enrolled to store a confirmed entry. If a dancer is selected, it
          is stored for that dancer; otherwise it is stored for the whole family.
          Enrolled comps appear on My Comps, with a star on that calendar.
          When you are signed in, friends of that dancer see the enrolment
          automatically. Reminders follow your dancers’ styles. Always confirm
          dates on the organiser website.
        </p>
      </div>
      {completed ? (
        <ErrorBoundary>
          <CompReviewSection comp={comp} />
        </ErrorBoundary>
      ) : null}
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
