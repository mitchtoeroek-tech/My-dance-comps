"use client";

import { useReviews } from "@/hooks/useReviews";
import {
  formatAverage,
  formatReviewCount,
} from "@/lib/reviews";
import { StarRating } from "./StarRating";

export function CompReviewSummary({
  competitionId,
}: {
  competitionId: string;
}) {
  const { ready, aggregateFor } = useReviews();
  if (!ready) {
    return <div className="mt-2 h-5" aria-hidden />;
  }

  const { average, count } = aggregateFor(competitionId);
  if (count === 0) {
    return (
      <p className="mt-2 text-xs font-semibold text-muted-foreground">
        Not yet rated on this device
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <StarRating value={average} readOnly size="sm" label="Average rating" />
      <p className="text-xs font-bold text-foreground">
        {formatAverage(average)} · {formatReviewCount(count)} on this device
      </p>
    </div>
  );
}
