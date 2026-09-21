import type { CompReview } from "./types";
import {
  loadReviewsState,
  reviewsForCompetition,
  saveReviewsState,
  upsertReviewInState,
} from "./reviews";

/**
 * Public (everyone-visible) reviews stay off until
 * `NEXT_PUBLIC_REVIEWS_PUBLIC=1` and a signed-in `userId` is supplied.
 * Guest MVP still writes only to localStorage so device reviews do not
 * pretend to be a public feed.
 */
export const PUBLIC_REVIEWS_ENABLED =
  process.env.NEXT_PUBLIC_REVIEWS_PUBLIC === "1";

/**
 * Persist a review. Always upserts the guest copy in localStorage (one
 * review per competition on this device). Shared backend write is stubbed.
 */
export async function persistReview(input: {
  competitionId: string;
  stars: CompReview["stars"];
  comment?: string;
  userId?: string | null;
  displayName?: string | null;
}): Promise<CompReview> {
  const current = loadReviewsState();
  const next = upsertReviewInState(current, input);
  saveReviewsState(next);
  const saved = next.byCompetitionId[input.competitionId.trim()];
  if (!saved) {
    throw new Error("Review could not be saved on this device.");
  }
  await syncReviewToBackend(saved);
  return saved;
}

/**
 * Public feed for a competition. Empty until accounts + `reviews` table
 * are live — callers must not invent other users’ comments.
 */
export async function listPublicReviews(
  _competitionId: string,
): Promise<CompReview[]> {
  void _competitionId;
  if (!PUBLIC_REVIEWS_ENABLED) return [];
  return [];
}

/**
 * Later, with a signed-in session:
 *
 *   import { getSupabase } from "./supabase";
 *   const client = getSupabase();
 *   if (!client || !review.userId) return;
 *   await client.from("reviews").upsert(
 *     {
 *       competition_id: review.competitionId,
 *       user_id: review.userId,
 *       display_name: review.displayName,
 *       stars: review.stars,
 *       comment: review.comment,
 *       updated_at: review.updatedAt,
 *     },
 *     { onConflict: "competition_id,user_id" },
 *   );
 *
 * Guests (userId === null) stay in localStorage only.
 */
export async function syncReviewToBackend(_review: CompReview): Promise<void> {
  void _review;
}

export function localReviewForCompetition(
  competitionId: string,
): CompReview | null {
  return (
    reviewsForCompetition(loadReviewsState(), competitionId)[0] ?? null
  );
}
