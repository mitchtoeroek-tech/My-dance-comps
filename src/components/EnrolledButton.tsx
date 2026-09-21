"use client";

export function EnrolledButton({
  enrolled,
  onClick,
}: {
  enrolled: boolean;
  onClick?: () => void;
}) {
  const label = enrolled ? "Un-enrol from this competition" : "Mark as enrolled";
  if (!onClick) {
    return (
      <span
        className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ${
          enrolled
            ? "bg-primary text-white"
            : "bg-surface text-muted-foreground ring-1 ring-border"
        }`}
      >
        <span aria-hidden className="text-[11px] leading-none">
          ★
        </span>
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
      className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ${
        enrolled
          ? "bg-primary text-white"
          : "bg-surface text-muted-foreground ring-1 ring-border"
      }`}
    >
      <span aria-hidden className="text-[11px] leading-none">
        ★
      </span>
      Enrolled
    </button>
  );
}
