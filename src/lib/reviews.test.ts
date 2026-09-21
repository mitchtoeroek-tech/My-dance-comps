import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReviewCompetition,
  defaultReviewsState,
  formatAverage,
  formatReviewCount,
  isReviewStars,
  MAX_REVIEW_COMMENT,
  normalizeReview,
  normalizeReviewsState,
  reviewAggregate,
  reviewsForCompetition,
  sanitizeReviewComment,
  upsertReviewInState,
} from "./reviews";
import type { Competition } from "./types";

function makeComp(partial: Partial<Competition> & Pick<Competition, "id">): Competition {
  return {
    name: partial.name ?? partial.id,
    kind: "competition",
    organiser: "Org",
    organiserUrl: "https://example.com",
    venue: "Venue",
    suburb: "Suburb",
    state: "SA",
    startDate: "2026-06-01",
    endDate: "2026-06-02",
    registrationOpens: null,
    registrationCloses: null,
    registrationUrl: "https://example.com",
    infoUrl: "https://example.com",
    styles: ["Jazz"],
    minAge: 4,
    maxAge: 18,
    isNational: false,
    notes: "",
    sourceId: "seed",
    lastUpdated: "2026-09-21",
    ...partial,
  };
}

describe("normalizeReview", () => {
  it("accepts a valid 1–5 star review and trims comment", () => {
    const review = normalizeReview({
      id: "r1",
      competitionId: "comp-1",
      userId: null,
      displayName: "  ",
      stars: 4,
      comment: "  Lovely day  ",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
    });
    assert.ok(review);
    assert.equal(review?.stars, 4);
    assert.equal(review?.comment, "Lovely day");
    assert.equal(review?.userId, null);
    assert.equal(review?.displayName, null);
  });

  it("drops missing competition id, invalid stars, and out-of-range ratings", () => {
    assert.equal(normalizeReview({ stars: 4 }), null);
    assert.equal(normalizeReview({ competitionId: "x", stars: 0 }), null);
    assert.equal(normalizeReview({ competitionId: "x", stars: 6 }), null);
    assert.equal(normalizeReview({ competitionId: "x", stars: "three" }), null);
    assert.equal(isReviewStars(5), true);
    assert.equal(isReviewStars(0), false);
  });
});

describe("sanitizeReviewComment", () => {
  it("caps length and strips control characters", () => {
    assert.equal(sanitizeReviewComment("ok\u0000day").includes("\u0000"), false);
    assert.equal(sanitizeReviewComment("a".repeat(MAX_REVIEW_COMMENT + 20)).length, MAX_REVIEW_COMMENT);
  });
});

describe("upsertReviewInState", () => {
  it("upserts one review per competition and keeps createdAt", () => {
    const first = upsertReviewInState(defaultReviewsState, {
      competitionId: "comp-1",
      stars: 3,
      comment: "Fine",
      now: new Date("2026-09-21T01:00:00.000Z"),
    });
    const second = upsertReviewInState(first, {
      competitionId: "comp-1",
      stars: 5,
      comment: "Brilliant",
      now: new Date("2026-09-21T02:00:00.000Z"),
    });
    const other = upsertReviewInState(second, {
      competitionId: "comp-2",
      stars: 2,
      now: new Date("2026-09-21T03:00:00.000Z"),
    });

    assert.equal(Object.keys(other.byCompetitionId).length, 2);
    assert.equal(other.byCompetitionId["comp-1"]?.stars, 5);
    assert.equal(other.byCompetitionId["comp-1"]?.comment, "Brilliant");
    assert.equal(
      other.byCompetitionId["comp-1"]?.createdAt,
      first.byCompetitionId["comp-1"]?.createdAt,
    );
    assert.equal(
      other.byCompetitionId["comp-1"]?.updatedAt,
      "2026-09-21T02:00:00.000Z",
    );
    assert.equal(reviewsForCompetition(other, "comp-1").length, 1);
  });

  it("ignores invalid stars instead of writing a bad row", () => {
    const next = upsertReviewInState(defaultReviewsState, {
      competitionId: "comp-1",
      stars: 0 as never,
    });
    assert.deepEqual(next, defaultReviewsState);
  });
});

describe("reviewAggregate", () => {
  it("returns zero for an empty list and averages local reviews only", () => {
    assert.deepEqual(reviewAggregate([]), { average: 0, count: 0 });
    const state = upsertReviewInState(defaultReviewsState, {
      competitionId: "comp-1",
      stars: 4,
    });
    assert.deepEqual(reviewAggregate(reviewsForCompetition(state, "comp-1")), {
      average: 4,
      count: 1,
    });
    assert.equal(formatAverage(4), "4.0");
    assert.equal(formatReviewCount(1), "1 review");
    assert.equal(formatReviewCount(0), "0 reviews");
    assert.equal(formatReviewCount(2), "2 reviews");
  });
});

describe("normalizeReviewsState", () => {
  it("drops corrupt rows and unknown fields", () => {
    const normalized = normalizeReviewsState({
      version: 9,
      extra: true,
      byCompetitionId: {
        ok: { competitionId: "ok", stars: 5, comment: "Yep" },
        bad: { competitionId: "bad", stars: 9 },
      },
    });
    assert.equal(normalized.version, 1);
    assert.equal("extra" in normalized, false);
    assert.equal(Object.keys(normalized.byCompetitionId).length, 1);
    assert.equal(normalized.byCompetitionId.ok?.stars, 5);
  });
});

describe("canReviewCompetition", () => {
  const now = new Date("2026-09-21T00:00:00+09:30");

  it("allows reviews only after the event end date in Australia/Adelaide", () => {
    assert.equal(
      canReviewCompetition(makeComp({ id: "past", endDate: "2026-09-20" }), now),
      true,
    );
    assert.equal(
      canReviewCompetition(
        makeComp({ id: "today", startDate: "2026-09-21", endDate: "2026-09-21" }),
        now,
      ),
      false,
    );
    assert.equal(
      canReviewCompetition(
        makeComp({ id: "future", startDate: "2026-10-01", endDate: "2026-10-03" }),
        now,
      ),
      false,
    );
  });
});
