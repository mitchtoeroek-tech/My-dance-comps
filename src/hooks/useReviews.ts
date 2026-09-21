"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { persistReview } from "@/lib/reviews-backend";
import {
  defaultReviewsState,
  loadReviewsState,
  reviewAggregate,
  reviewsForCompetition,
  type ReviewAggregate,
} from "@/lib/reviews";
import type { CompReview, ReviewsState, ReviewStars } from "@/lib/types";

let memory: ReviewsState = defaultReviewsState;
let hydrated = false;
const listeners = new Set<() => void>();

function snapshot(): ReviewsState {
  return memory;
}

function getServerSnapshot(): ReviewsState {
  return defaultReviewsState;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  memory = loadReviewsState();
  emit();
}

export function useReviews() {
  const state = useSyncExternalStore(
    subscribe,
    snapshot,
    getServerSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  const getReview = useCallback(
    (competitionId: string): CompReview | null =>
      reviewsForCompetition(state, competitionId)[0] ?? null,
    [state],
  );

  const aggregateFor = useCallback(
    (competitionId: string): ReviewAggregate =>
      reviewAggregate(reviewsForCompetition(state, competitionId)),
    [state],
  );

  const upsertReview = useCallback(
    async (input: {
      competitionId: string;
      stars: ReviewStars;
      comment?: string;
    }): Promise<CompReview> => {
      hydrateFromStorage();
      const saved = await persistReview(input);
      memory = loadReviewsState();
      hydrated = true;
      emit();
      return saved;
    },
    [],
  );

  return useMemo(
    () => ({
      ready,
      state,
      getReview,
      aggregateFor,
      upsertReview,
    }),
    [ready, state, getReview, aggregateFor, upsertReview],
  );
}
