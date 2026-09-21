"use client";

export function EnrolledButton({
  enrolled,
  onClick,
}: {
  enrolled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enrolled}
      aria-label={enrolled ? "Remove confirmed entry" : "Mark as entered"}
      className={`inline-flex min-h-11 items-center rounded-control px-3 py-1.5 text-xs font-bold ${
        enrolled
          ? "bg-primary text-white"
          : "bg-surface text-primary-ink ring-1 ring-primary"
      }`}
    >
      {enrolled ? "Entered" : "Mark as entered"}
    </button>
  );
}
