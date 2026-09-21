"use client";

import { REVIEW_STARS, type ReviewStars } from "@/lib/types";

const STAR_PATH =
  "M12 4.8 14.2 9l4.8.6-3.5 3.3.9 4.7L12 15.7 7.6 17.6l.9-4.7L5 9.6 9.8 9 12 4.8Z";

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "lg",
  label = "Rating",
}: {
  value: number;
  onChange?: (stars: ReviewStars) => void;
  readOnly?: boolean;
  size?: "sm" | "lg";
  label?: string;
}) {
  const filledThrough = readOnly
    ? Math.round(Number.isFinite(value) ? value : 0)
    : value;
  const interactive = !readOnly && typeof onChange === "function";
  const box = size === "sm" ? "h-5 w-5" : "h-11 w-11";
  const svg = size === "sm" ? 18 : 28;

  if (!interactive) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-primary"
        aria-label={`${label}: ${Number.isFinite(value) ? value.toFixed(1) : "0.0"} out of 5`}
      >
        {REVIEW_STARS.map((star) => (
          <StarIcon
            key={star}
            size={svg}
            filled={star <= filledThrough}
            className={box}
          />
        ))}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5"
    >
      {REVIEW_STARS.map((star) => {
        const checked = value === star;
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={star === 1 ? "1 star" : `${star} stars`}
            onClick={() => onChange(star)}
            className={`grid ${box} place-items-center rounded-control text-primary transition-transform active:scale-95`}
          >
            <StarIcon size={svg} filled={filled} />
          </button>
        );
      })}
    </div>
  );
}

function StarIcon({
  size,
  filled,
  className,
}: {
  size: number;
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
    >
      <path
        d={STAR_PATH}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
