import Link from "next/link";
import { formatDateRange } from "@/lib/datetime";
import { registrationStatus } from "@/lib/comps";
import type { Competition } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { StarButton } from "./StarButton";

export function CompCard({
  comp,
  saved,
  onToggleSave,
  ageHint,
}: {
  comp: Competition;
  saved: boolean;
  onToggleSave: () => void;
  ageHint?: string;
}) {
  const status = registrationStatus(comp);
  const styles = Array.isArray(comp.styles) ? comp.styles : [];
  return (
    <article className="relative overflow-hidden rounded-3xl bg-[var(--cream-raised)] p-4 shadow-[0_10px_30px_-18px_rgba(90,30,50,0.45)] ring-1 ring-[var(--line)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <span className="rounded-full bg-[var(--teal-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--teal)]">
              {comp.isNational ? "National" : comp.state}
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold leading-snug text-[var(--ink)]">
            <Link href={`/comps/${comp.id}`} className="hover:underline">
              {comp.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--ink-soft)]">
            {formatDateRange(comp.startDate, comp.endDate)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
            {comp.suburb}, {comp.state} · {comp.organiser}
          </p>
        </div>
        <StarButton saved={saved} onClick={onToggleSave} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {styles.slice(0, 5).map((style) => (
          <span
            key={style}
            className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)]"
          >
            {style}
          </span>
        ))}
        {styles.length > 5 ? (
          <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-soft)]">
            +{styles.length - 5}
          </span>
        ) : null}
      </div>
      {ageHint ? (
        <p className="mt-2 text-xs font-medium text-[var(--teal)]">{ageHint}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link
          href={`/comps/${comp.id}`}
          className="rounded-full bg-[var(--raspberry)] px-3 py-1.5 text-xs font-bold text-white"
        >
          Details
        </Link>
        <a
          href={comp.registrationUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--teal)] ring-1 ring-[var(--teal)]"
        >
          Register
        </a>
      </div>
    </article>
  );
}
