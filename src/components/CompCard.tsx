import Link from "next/link";
import { adelaideToday, formatDateRange } from "@/lib/datetime";
import { formatCompLocation, registrationStatus } from "@/lib/comps";
import { compHasEnded } from "@/lib/filter";
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
  const past = compHasEnded(comp, adelaideToday());
  return (
    <article
      className={`relative overflow-hidden rounded-card p-4 shadow-card ring-1 ring-border ${
        past ? "bg-past-surface" : "bg-surface"
      }`}
      data-ended={past ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <span className="rounded-control bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
              {comp.isNational ? "National" : comp.state}
            </span>
          </div>
          <h2
            className={`text-lg font-bold leading-snug ${
              past ? "text-foreground/70" : "text-foreground"
            }`}
          >
            <Link href={`/comps/${comp.id}`} className="hover:underline">
              {comp.name}
            </Link>
          </h2>
          <p
            className={`mt-1 text-sm font-medium ${
              past ? "text-muted-foreground/90" : "text-muted-foreground"
            }`}
          >
            {formatDateRange(comp.startDate, comp.endDate)}
          </p>
          <p
            className={`mt-0.5 text-sm font-semibold ${
              past ? "text-foreground/65" : "text-foreground"
            }`}
          >
            {formatCompLocation(comp)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {comp.organiser}
          </p>
        </div>
        <StarButton saved={saved} onClick={onToggleSave} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {styles.slice(0, 5).map((style) => (
          <span
            key={style}
            className="rounded-control bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground"
          >
            {style}
          </span>
        ))}
        {styles.length > 5 ? (
          <span className="rounded-control bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            +{styles.length - 5}
          </span>
        ) : null}
      </div>
      {ageHint ? (
        <p className="mt-2 text-xs font-medium text-primary-ink">{ageHint}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link
          href={`/comps/${comp.id}`}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          Details
        </Link>
        <a
          href={comp.registrationUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-control bg-surface px-3 py-1.5 text-xs font-bold text-primary-ink ring-1 ring-primary"
        >
          Register
        </a>
      </div>
    </article>
  );
}
