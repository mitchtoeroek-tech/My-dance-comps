"use client";

import { useState } from "react";
import { useReviews } from "@/hooks/useReviews";
import { PUBLIC_REVIEWS_ENABLED } from "@/lib/reviews-backend";
import {
  canReviewCompetition,
  formatAverage,
  isReviewStars,
  MAX_REVIEW_COMMENT,
} from "@/lib/reviews";
import { formatShortDate } from "@/lib/datetime";
import type { Competition } from "@/lib/types";
import { StarRating } from "./StarRating";

export function CompReviewSection({ comp }: { comp: Competition }) {
  const completed = canReviewCompetition(comp);
  const { ready, getReview, upsertReview } = useReviews();
  const existing = ready ? getReview(comp.id) : null;
  const [draftStars, setDraftStars] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stars = draftStars ?? existing?.stars ?? 0;
  const comment = draftComment ?? existing?.comment ?? "";

  if (!completed) return null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isReviewStars(stars)) {
      setError("Choose a star rating (1–5).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await upsertReview({
        competitionId: comp.id,
        stars,
        comment,
      });
      setDraftStars(null);
      setDraftComment(null);
      setSavedAt("Saved on this device.");
    } catch {
      setError("Could not save your review on this device. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div>
        <h2 className="text-lg font-bold text-foreground">Your review</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Rate this finished competition. Comments are optional. Your review
          stays on this device until accounts go live.
        </p>
      </div>

      {ready && existing ? (
        <div className="rounded-control bg-primary-soft px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
            Your review
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRating
              value={existing.stars}
              readOnly
              size="sm"
              label="Your rating"
            />
            <p className="text-sm font-bold text-foreground">
              {formatAverage(existing.stars)}
            </p>
          </div>
          {existing.comment ? (
            <p className="mt-1 text-sm leading-6 text-foreground">
              {existing.comment}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No comment</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatShortDate(existing.updatedAt)}
          </p>
        </div>
      ) : null}

      {ready ? (
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <p className="mb-1 text-sm font-bold text-foreground">
              {existing ? "Update your rating" : "Tap to rate"}
            </p>
            <StarRating
              value={stars}
              onChange={(next) => {
                setDraftStars(next);
                setError("");
                setSavedAt(null);
              }}
              label="Star rating"
            />
          </div>
          <label className="block text-sm font-bold text-foreground">
            Comment (optional)
            <textarea
              value={comment}
              onChange={(event) => {
                setDraftComment(event.target.value.slice(0, MAX_REVIEW_COMMENT));
                setSavedAt(null);
              }}
              rows={3}
              maxLength={MAX_REVIEW_COMMENT}
              placeholder="How did the day run? Venue, timing, atmosphere…"
              className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {comment.length}/{MAX_REVIEW_COMMENT}
          </p>
          {error ? (
            <p className="text-sm font-semibold text-status-closed-ink" role="alert">
              {error}
            </p>
          ) : null}
          {savedAt ? (
            <p className="text-sm font-semibold text-primary-ink" role="status">
              {savedAt}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {existing ? "Update review" : "Save review"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Loading your review…</p>
      )}

      <div className="border-t border-border pt-3">
        <h3 className="text-sm font-bold text-foreground">Public reviews</h3>
        {PUBLIC_REVIEWS_ENABLED ? (
          <ul className="mt-2 space-y-2">
            <li className="text-sm leading-6 text-muted-foreground">
              No public reviews yet.
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Public reviews unlock when accounts go live
          </p>
        )}
      </div>
    </section>
  );
}
