"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useReviews } from "@/hooks/useReviews";
import { loginPathWithNext, signupPathWithNext } from "@/lib/friends";
import { listPublicReviews } from "@/lib/reviews-backend";
import {
  canReviewCompetition,
  formatAverage,
  isReviewStars,
  MAX_REVIEW_COMMENT,
  publicReviewerName,
  reviewDisplayName,
} from "@/lib/reviews";
import { formatShortDate } from "@/lib/datetime";
import type { Competition, CompReview } from "@/lib/types";
import { StarRating } from "./StarRating";

export function CompReviewSection({ comp }: { comp: Competition }) {
  const completed = canReviewCompetition(comp);
  const { user, account } = useAuth();
  const { ready, getReview, upsertReview } = useReviews();
  const local = ready ? getReview(comp.id) : null;
  const [publicReviews, setPublicReviews] = useState<CompReview[] | null>(null);
  const [publicError, setPublicError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [draftStars, setDraftStars] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!completed) return;
    let cancelled = false;
    void listPublicReviews(comp.id).then((result) => {
      if (cancelled) return;
      setPublicReviews(result.reviews);
      setPublicError(result.error ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [comp.id, completed, reloadKey]);

  const published =
    user && publicReviews
      ? publicReviews.find((review) => review.userId === user.id) ?? null
      : null;
  const existing =
    published ?? (user && local?.userId === user.id ? local : null);
  const formSource = existing ?? (user ? local : null);
  const stars = draftStars ?? formSource?.stars ?? 0;
  const comment = draftComment ?? formSource?.comment ?? "";

  if (!completed) return null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
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
        userId: user.id,
        displayName: reviewDisplayName({
          displayName: account?.displayName,
          email: user.email,
        }),
      });
      setDraftStars(null);
      setDraftComment(null);
      setSavedAt("Your review is public.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not publish your review. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const loginHref = loginPathWithNext(`/comps/${comp.id}`);
  const signupHref = signupPathWithNext(`/comps/${comp.id}`);

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div>
        <h2 className="text-lg font-bold text-foreground">Your review</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Rate this finished competition. Comments are optional. Your review
          is public for other families on My Dance Comps.
        </p>
      </div>

      {user && existing ? (
        <div className="rounded-control bg-primary-soft px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
            Your public review
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

      {user ? (
        ready ? (
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
              {busy ? "Publishing…" : existing ? "Update review" : "Publish review"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Loading your review…</p>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Sign in to publish a review. Anyone can read the public list below.
          </p>
          {local ? (
            <p className="text-sm leading-6 text-muted-foreground">
              A rating saved on this device is not public yet. Log in and save
              it to share it.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={loginHref}
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Log in to review
            </Link>
            <Link
              href={signupHref}
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <h3 className="text-sm font-bold text-foreground">Public reviews</h3>
        {publicError ? (
          <p className="mt-1 text-sm leading-6 text-status-closed-ink" role="alert">
            {publicError}
          </p>
        ) : publicReviews === null ? (
          <p className="mt-1 text-sm text-muted-foreground">Loading public reviews…</p>
        ) : publicReviews.length === 0 ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            No public reviews yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-3" aria-label="Public reviews">
            {publicReviews.map((review) => (
              <li key={review.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-foreground">
                    {publicReviewerName(review.displayName)}
                  </p>
                  <StarRating
                    value={review.stars}
                    readOnly
                    size="sm"
                    label={`${publicReviewerName(review.displayName)} rating`}
                  />
                </div>
                {review.comment ? (
                  <p className="text-sm leading-6 text-foreground">{review.comment}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatShortDate(review.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
