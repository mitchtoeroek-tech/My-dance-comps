import type { CompReview } from "./types";
import { getSupabase } from "./supabase";
import {
  aggregateStarRows,
  loadReviewsState,
  reviewFromPublicRow,
  reviewsForCompetition,
  saveReviewsState,
  upsertReviewInState,
} from "./reviews";

const REVIEW_COLUMNS =
  "id, competition_id, user_id, display_name, stars, comment, created_at, updated_at";

type QueryError = { message?: string } | null;

export function friendlyReviewError(
  error: QueryError | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    (lower.includes("reviews") && lower.includes("does not exist"))
  ) {
    return "Public reviews are not in the database yet. Run supabase/migrations/20260921_reviews.sql in the Supabase SQL editor, then try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authenticated") ||
    lower.includes("jwt")
  ) {
    return "Sign in to publish a review.";
  }
  if (lower.includes("stars") || lower.includes("check constraint")) {
    return "Choose a star rating from 1 to 5.";
  }
  if (!message) return "Could not publish your review. Try again.";
  return message;
}

/**
 * Save a review. Signed-in reviews are published for every family.
 * A guest review stays on this device until they sign in and save it.
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
  const saved = next.byCompetitionId[input.competitionId.trim()];
  if (!saved) {
    throw new Error("Review could not be saved.");
  }
  if (saved.userId) {
    const error = await syncReviewToBackend(saved);
    if (error) throw new Error(error);
  }
  saveReviewsState(next);
  return saved;
}

/** Public feed for one finished competition, newest first. */
export async function listPublicReviews(competitionId: string): Promise<{
  reviews: CompReview[];
  error: string | null;
}> {
  const id = competitionId.trim();
  if (!id) return { reviews: [], error: null };
  const supabase = getSupabase();
  if (!supabase) return { reviews: [], error: null };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(REVIEW_COLUMNS)
      .eq("competition_id", id)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { reviews: [], error: friendlyReviewError(error) };
    const reviews = (data ?? []).flatMap((row) => {
      const review = reviewFromPublicRow(row);
      return review ? [review] : [];
    });
    return { reviews, error: null };
  } catch (error) {
    return {
      reviews: [],
      error: friendlyReviewError(error instanceof Error ? error.message : null),
    };
  }
}

/** Star totals for competition cards. One read shared by every card. */
export async function listPublicReviewAggregates(): Promise<{
  byCompetitionId: Record<string, { average: number; count: number }>;
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { byCompetitionId: {}, error: null };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("competition_id, stars")
      .limit(2000);
    if (error) return { byCompetitionId: {}, error: friendlyReviewError(error) };
    const rows = (data ?? []).flatMap((row) => {
      const record = row as { competition_id?: unknown; stars?: unknown };
      const competitionId =
        typeof record.competition_id === "string" ? record.competition_id : "";
      const stars =
        typeof record.stars === "number" ? record.stars : Number(record.stars);
      if (!competitionId || !Number.isFinite(stars)) return [];
      return [{ competitionId, stars }];
    });
    return { byCompetitionId: aggregateStarRows(rows), error: null };
  } catch (error) {
    return {
      byCompetitionId: {},
      error: friendlyReviewError(error instanceof Error ? error.message : null),
    };
  }
}

export async function syncReviewToBackend(review: CompReview): Promise<string | null> {
  if (!review.userId) return null;
  const supabase = getSupabase();
  if (!supabase) {
    return "Sign in to publish a review.";
  }
  const { error } = await supabase.from("reviews").upsert(
    {
      competition_id: review.competitionId,
      user_id: review.userId,
      display_name: review.displayName,
      stars: review.stars,
      comment: review.comment,
    },
    { onConflict: "competition_id,user_id" },
  );
  return error ? friendlyReviewError(error) : null;
}

export function localReviewForCompetition(
  competitionId: string,
): CompReview | null {
  return reviewsForCompetition(loadReviewsState(), competitionId)[0] ?? null;
}
