"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  listPublicReviewAggregates,
  persistReview,
} from "@/lib/reviews-backend";
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
      userId?: string | null;
      displayName?: string | null;
    }): Promise<CompReview> => {
      hydrateFromStorage();
      const saved = await persistReview(input);
      memory = loadReviewsState();
      hydrated = true;
      emit();
      void refreshPublicAggregates();
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

interface PublicAggregateSnapshot {
  ready: boolean;
  byId: Record<string, ReviewAggregate>;
}

const EMPTY_PUBLIC_AGGREGATES: PublicAggregateSnapshot = {
  ready: false,
  byId: {},
};

let publicAggregates: PublicAggregateSnapshot = EMPTY_PUBLIC_AGGREGATES;
let publicInflight: Promise<void> | null = null;
const publicListeners = new Set<() => void>();

function emitPublicAggregates() {
  publicListeners.forEach((listener) => listener());
}

function subscribePublicAggregates(listener: () => void) {
  publicListeners.add(listener);
  return () => {
    publicListeners.delete(listener);
  };
}

function applyPublicAggregates(
  byId: Record<string, ReviewAggregate>,
) {
  publicAggregates = { ready: true, byId };
  publicInflight = null;
  emitPublicAggregates();
}

export function refreshPublicAggregates(): Promise<void> {
  const run = listPublicReviewAggregates()
    .then((result) => {
      if (publicInflight !== run) return;
      applyPublicAggregates(
        result.error ? publicAggregates.byId : result.byCompetitionId,
      );
    })
    .catch(() => {
      if (publicInflight !== run) return;
      applyPublicAggregates(publicAggregates.byId);
    });
  publicInflight = run;
  return run;
}

function ensurePublicAggregates() {
  if (publicAggregates.ready || publicInflight) return;
  void refreshPublicAggregates();
}

/** Public star average for competition cards. */
export function usePublicReviewAggregate(competitionId: string): {
  ready: boolean;
  average: number;
  count: number;
} {
  const snapshot = useSyncExternalStore(
    subscribePublicAggregates,
    () => publicAggregates,
    () => EMPTY_PUBLIC_AGGREGATES,
  );

  useEffect(() => {
    ensurePublicAggregates();
  }, []);

  const row = snapshot.byId[competitionId];
  return {
    ready: snapshot.ready,
    average: row?.average ?? 0,
    count: row?.count ?? 0,
  };
}
