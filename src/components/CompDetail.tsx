"use client";

import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { registrationStatus } from "@/lib/comps";
import { formatDateRange, formatDateTime } from "@/lib/datetime";
import { competitionToIcs, downloadIcs } from "@/lib/ics";
import type { Competition } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { StarButton } from "./StarButton";

export function CompDetail({ comp }: { comp: Competition }) {
  const { isFavourite, toggleFavourite } = useFamily();
  const saved = isFavourite(comp.id);
  const status = registrationStatus(comp);

  return (
    <article className="space-y-4">
      <Link
        href="/"
        className="text-sm font-bold text-[var(--teal)] hover:underline"
      >
        ← All comps
      </Link>
      <div className="rounded-3xl bg-[var(--cream-raised)] p-4 ring-1 ring-[var(--line)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill status={status} />
              <span className="rounded-full bg-[var(--teal-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--teal)]">
                {comp.isNational ? "National" : comp.state}
              </span>
              <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--gold-ink)]">
                {comp.kind}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight text-[var(--ink)]">
              {comp.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-[var(--ink-soft)]">
              {formatDateRange(comp.startDate, comp.endDate)}
            </p>
          </div>
          <StarButton saved={saved} onClick={() => toggleFavourite(comp.id)} />
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Venue" value={`${comp.venue}, ${comp.suburb} ${comp.state}`} />
          <Row
            label="Organiser"
            value={
              <a
                className="font-semibold text-[var(--teal)] underline"
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
          {comp.styles.map((style) => (
            <span
              key={style}
              className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-semibold"
            >
              {style}
            </span>
          ))}
        </div>
        {comp.notes ? (
          <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{comp.notes}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={comp.registrationUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
          >
            Registration link
          </a>
          <a
            href={comp.infoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--ink)] ring-1 ring-[var(--line)]"
          >
            Organiser info
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(`${comp.id}.ics`, competitionToIcs(comp))}
            className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white"
          >
            Add dates to calendar
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--ink-soft)]">
          Saving this comp adds it to Reminders so you can get entry open/close
          nudges. Always confirm dates on the organiser website.
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
      <dt className="text-[var(--ink-soft)]">{label}</dt>
      <dd className="text-right font-semibold text-[var(--ink)]">{value}</dd>
    </div>
  );
}
