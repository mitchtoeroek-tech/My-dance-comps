import { adelaideToday } from "./datetime";
import { compHasEnded } from "./filter";
import { newId } from "./storage";
import type { Competition, CompReview, ReviewsState, ReviewStars } from "./types";

export const REVIEWS_STORAGE_KEY = "mydancecomps.reviews.v1";
export const MAX_REVIEW_COMMENT = 500;

export const defaultReviewsState: ReviewsState = {
  version: 1,
  byCompetitionId: {},
};

export function isReviewStars(value: unknown): value is ReviewStars {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = asString(value).trim();
  return text ? text : null;
}

export function sanitizeReviewComment(value: unknown): string {
  const text = asString(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  return text.slice(0, MAX_REVIEW_COMMENT);
}

export function normalizeReview(raw: unknown): CompReview | null {
  if (!isRecord(raw)) return null;
  const competitionId = asString(raw.competitionId).trim();
  if (!competitionId) return null;
  const starsRaw = raw.stars;
  const stars =
    typeof starsRaw === "number" ? starsRaw : Number(starsRaw);
  if (!isReviewStars(stars)) return null;
  const createdAt =
    asString(raw.createdAt).trim() || new Date(0).toISOString();
  const updatedAt = asString(raw.updatedAt).trim() || createdAt;
  const id = asString(raw.id).trim() || `local-${competitionId}`;
  return {
    id,
    competitionId,
    userId: asNullableString(raw.userId),
    displayName: asNullableString(raw.displayName),
    stars,
    comment: sanitizeReviewComment(raw.comment),
    createdAt,
    updatedAt,
  };
}

export function normalizeReviewsState(raw: unknown): ReviewsState {
  if (!isRecord(raw)) return defaultReviewsState;
  const source = isRecord(raw.byCompetitionId)
    ? raw.byCompetitionId
    : isRecord(raw.reviews)
      ? raw.reviews
      : {};
  const byCompetitionId: Record<string, CompReview> = {};
  for (const [key, value] of Object.entries(source)) {
    const review = normalizeReview({
      ...(isRecord(value) ? value : {}),
      competitionId: isRecord(value)
        ? asString(value.competitionId, key)
        : key,
    });
    if (!review) continue;
    byCompetitionId[review.competitionId] = review;
  }
  return { version: 1, byCompetitionId };
}

function wipeStorageKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* private mode / quota */
  }
}

export function loadReviewsState(): ReviewsState {
  if (typeof window === "undefined") return defaultReviewsState;
  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return defaultReviewsState;
    return normalizeReviewsState(JSON.parse(raw) as unknown);
  } catch {
    wipeStorageKey(REVIEWS_STORAGE_KEY);
    return defaultReviewsState;
  }
}

export function saveReviewsState(state: ReviewsState) {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeReviewsState(state);
    window.localStorage.setItem(
      REVIEWS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    /* Safari private mode and quota errors must not crash the UI */
  }
}

export function upsertReviewInState(
  state: ReviewsState,
  input: {
    competitionId: string;
    stars: ReviewStars;
    comment?: string;
    userId?: string | null;
    displayName?: string | null;
    now?: Date;
  },
): ReviewsState {
  const competitionId = input.competitionId.trim();
  if (!competitionId || !isReviewStars(input.stars)) return state;
  const nowIso = (input.now ?? new Date()).toISOString();
  const existing = state.byCompetitionId[competitionId];
  const next: CompReview = {
    id: existing?.id ?? newId(),
    competitionId,
    userId: input.userId === undefined ? (existing?.userId ?? null) : input.userId,
    displayName:
      input.displayName === undefined
        ? (existing?.displayName ?? null)
        : input.displayName,
    stars: input.stars,
    comment: sanitizeReviewComment(input.comment ?? ""),
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  return {
    version: 1,
    byCompetitionId: {
      ...state.byCompetitionId,
      [competitionId]: next,
    },
  };
}

/** Guest MVP: only this device’s review, so we never invent other people’s comments. */
export function reviewsForCompetition(
  state: ReviewsState,
  competitionId: string,
): CompReview[] {
  const review = state.byCompetitionId[competitionId];
  return review ? [review] : [];
}

export interface ReviewAggregate {
  average: number;
  count: number;
}

export function reviewAggregate(reviews: CompReview[]): ReviewAggregate {
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.length === 0) return { average: 0, count: 0 };
  let sum = 0;
  for (const review of list) {
    sum += review.stars;
  }
  return {
    average: Math.round((sum / list.length) * 10) / 10,
    count: list.length,
  };
}

export function formatAverage(average: number): string {
  if (!Number.isFinite(average) || average <= 0) return "0.0";
  return average.toFixed(1);
}

export function formatReviewCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return n === 1 ? "1 review" : `${n} reviews`;
}

/** Name stored on a public review. Never keep an email address. */
export function reviewDisplayName(input: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const named = (input.displayName ?? "").replace(/\s+/g, " ").trim();
  if (named && !named.includes("@")) return named.slice(0, 80);
  const local = (input.email ?? "")
    .split("@")[0]
    ?.replace(/[^a-zA-Z0-9._ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (local) return local.slice(0, 80);
  return "Member";
}

/** Name shown on the public list. Emails and blanks become Member. */
export function publicReviewerName(name: string | null | undefined): string {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.includes("@")) return "Member";
  return trimmed.slice(0, 80);
}

export function reviewFromPublicRow(raw: unknown): CompReview | null {
  if (!isRecord(raw)) return null;
  const review = normalizeReview({
    id: raw.id,
    competitionId: raw.competition_id ?? raw.competitionId,
    userId: raw.user_id ?? raw.userId,
    displayName: raw.display_name ?? raw.displayName,
    stars: raw.stars,
    comment: raw.comment,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
  });
  if (!review) return null;
  return { ...review, displayName: publicReviewerName(review.displayName) };
}

/** Average stars for each competition. Invalid ratings are dropped. */
export function aggregateStarRows(
  rows: readonly { competitionId: string; stars: number }[],
): Record<string, ReviewAggregate> {
  const grouped = new Map<string, ReviewStars[]>();
  for (const row of rows) {
    if (!isReviewStars(row.stars)) continue;
    const id = row.competitionId.trim();
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push(row.stars);
    grouped.set(id, list);
  }
  const out: Record<string, ReviewAggregate> = {};
  for (const [id, stars] of grouped) {
    const sum = stars.reduce((total, value) => total + value, 0);
    out[id] = {
      average: Math.round((sum / stars.length) * 10) / 10,
      count: stars.length,
    };
  }
  return out;
}

/** Completed comps only: event end date before today in Australia/Adelaide. */
export function canReviewCompetition(
  comp: Competition,
  now: Date = new Date(),
): boolean {
  return compHasEnded(comp, adelaideToday(now));
}
