"use client";

export function EnrolledButton({
  enrolled,
  onClick,
}: {
  enrolled: boolean;
  onClick?: () => void;
}) {
  const label = enrolled ? "Un-enrol from this competition" : "Mark as enrolled";
  const tone = enrolled
    ? "bg-enrolled text-enrolled-ink"
    : "bg-surface text-primary-ink ring-1 ring-primary";
  const className = `inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-3 py-1.5 text-xs font-bold ${tone}`;

  if (!onClick) {
    return (
      <span className={className}>
        {enrolled ? (
          <span aria-hidden className="text-[11px] leading-none">
            ✓
          </span>
        ) : null}
        Enrolled
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enrolled}
      aria-label={label}
      className={className}
    >
      {enrolled ? (
        <span aria-hidden className="text-[11px] leading-none">
          ✓
        </span>
      ) : null}
      Enrolled
    </button>
  );
}
