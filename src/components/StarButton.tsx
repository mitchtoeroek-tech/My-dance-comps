"use client";

export function StarButton({
  saved,
  onClick,
  label = "Save competition",
}: {
  saved: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : label}
      className={`grid h-11 w-11 place-items-center rounded-full bg-surface shadow-sm ring-1 ring-border ${
        saved ? "text-primary-ink" : "text-muted-foreground"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 4.8 14.2 9l4.8.6-3.5 3.3.9 4.7L12 15.7 7.6 17.6l.9-4.7L5 9.6 9.8 9 12 4.8Z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
