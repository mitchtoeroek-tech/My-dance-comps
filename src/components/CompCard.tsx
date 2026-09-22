import Link from "next/link";
import { adelaideToday, formatDateRange } from "@/lib/datetime";
import { formatCompLocation, registrationStatus } from "@/lib/comps";
import { compHasEnded } from "@/lib/filter";
import type { Competition } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { StarButton } from "./StarButton";
import { EnrolledButton } from "./EnrolledButton";
import { CompReviewSummary } from "./CompReviewSummary";
import { CompLogo } from "./CompLogo";

export function CompCard({
  comp,
  saved,
  onToggleSave,
  enrolled,
  onToggleEnrolled,
  ageHint,
  eyebrow,
}: {
  comp: Competition;
  saved?: boolean;
  onToggleSave?: () => void;
  enrolled?: boolean;
  onToggleEnrolled?: () => void;
  ageHint?: string;
  eyebrow?: string;
}) {
  const status = registrationStatus(comp);
  const styles = Array.isArray(comp.styles) ? comp.styles : [];
  const past = compHasEnded(comp, adelaideToday());
  const showSave = typeof onToggleSave === "function";
  const showEnrolled = enrolled !== undefined;
  return (
    <article
      className={`relative overflow-hidden rounded-card p-4 shadow-card ring-1 ring-border ${
        past ? "bg-past-surface" : "bg-surface"
      }`}
      data-ended={past ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <CompLogo
          sourceId={comp.sourceId}
          organiser={comp.organiser}
          muted={past}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            <span className="rounded-control bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
              {comp.isNational ? "National" : comp.state}
            </span>
          </div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary-ink">
              {eyebrow}
            </p>
          ) : null}
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
          {past ? <CompReviewSummary competitionId={comp.id} /> : null}
        </div>
        {showSave || showEnrolled ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {showSave ? (
              <StarButton
                saved={Boolean(saved)}
                onClick={() => onToggleSave?.()}
              />
            ) : null}
            {showEnrolled ? (
              <EnrolledButton
                enrolled={Boolean(enrolled)}
                onClick={onToggleEnrolled}
              />
            ) : null}
          </div>
        ) : null}
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
      <div className="mt-3 flex flex-wrap gap-2">
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
