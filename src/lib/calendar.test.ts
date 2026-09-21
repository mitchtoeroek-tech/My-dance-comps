import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysIso,
  compsOnDate,
  eachDateInRange,
  marksForDay,
  monthGrid,
  selectCalendarComps,
  shiftMonth,
} from "./calendar";
import type { ChildProfile, Competition } from "./types";

function makeComp(
  partial: Partial<Competition> & Pick<Competition, "id">,
): Competition {
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

const saChild: ChildProfile = {
  id: "mia",
  name: "Mia",
  dob: "2018-06-15",
  styles: ["Jazz"],
  studio: "Studio",
  homeState: "SA",
};

const saComp = makeComp({
  id: "sa-local",
  state: "SA",
  startDate: "2026-09-12",
  endDate: "2026-09-13",
});
const nswComp = makeComp({
  id: "nsw-local",
  state: "NSW",
  startDate: "2026-09-20",
  endDate: "2026-09-20",
});
const vicFavourite = makeComp({
  id: "vic-fav",
  state: "VIC",
  startDate: "2026-09-22",
  endDate: "2026-09-24",
});
const qldEnrolled = makeComp({
  id: "qld-enrolled",
  state: "QLD",
  startDate: "2026-09-18",
  endDate: "2026-09-18",
});

const catalogue = [saComp, nswComp, vicFavourite, qldEnrolled];

describe("eachDateInRange", () => {
  it("spans multi-day events across every inclusive date", () => {
    assert.deepEqual(eachDateInRange("2026-09-12", "2026-09-14"), [
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
  });

  it("treats a missing end date as a single day", () => {
    assert.deepEqual(eachDateInRange("2026-09-01"), ["2026-09-01"]);
    assert.deepEqual(eachDateInRange("not-a-date", "2026-09-02"), []);
  });
});

describe("monthGrid", () => {
  it("starts on Monday and covers six weeks", () => {
    const cells = monthGrid(2026, 9);
    assert.equal(cells.length, 42);
    assert.equal(cells[0]?.iso, "2026-08-31");
    assert.equal(cells[0]?.inMonth, false);
    assert.equal(cells[1]?.iso, "2026-09-01");
    assert.equal(cells[1]?.inMonth, true);
    assert.equal(addDaysIso("2026-09-01", 1), "2026-09-02");
  });
});

describe("shiftMonth", () => {
  it("wraps across years", () => {
    assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), {
      year: 2027,
      month: 1,
    });
    assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), {
      year: 2025,
      month: 12,
    });
  });
});

describe("selectCalendarComps", () => {
  const filters = {
    query: "",
    includeInterstate: false,
    child: saChild,
    homeState: "SA" as const,
  };

  it("keeps home-state comps and does not dump interstate by default", () => {
    const ids = selectCalendarComps(catalogue, {
      filters,
      favouriteIds: [],
      enrolledIds: [],
    }).map((comp) => comp.id);
    assert.deepEqual(ids, ["sa-local"]);
    assert.ok(!ids.includes("nsw-local"));
  });

  it("still plots favourites and enrolled comps outside the filter", () => {
    const ids = selectCalendarComps(catalogue, {
      filters,
      favouriteIds: ["vic-fav"],
      enrolledIds: ["qld-enrolled"],
    }).map((comp) => comp.id);
    assert.ok(ids.includes("sa-local"));
    assert.ok(ids.includes("vic-fav"));
    assert.ok(ids.includes("qld-enrolled"));
    assert.ok(!ids.includes("nsw-local"));
  });
});

describe("compsOnDate and marksForDay", () => {
  it("spans multi-day events and marks status colours plus enrolled", () => {
    const on13 = compsOnDate([saComp, vicFavourite], "2026-09-13");
    assert.deepEqual(
      on13.map((comp) => comp.id),
      ["sa-local"],
    );
    const on23 = compsOnDate([vicFavourite], "2026-09-23");
    assert.equal(on23[0]?.id, "vic-fav");

    const now = new Date("2026-09-21T12:00:00+09:30");
    const openComp = makeComp({
      id: "open",
      startDate: "2026-09-13",
      endDate: "2026-09-13",
      registrationOpens: "2026-01-01T09:00:00",
      registrationCloses: "2026-12-01T17:00:00",
    });
    const closingComp = makeComp({
      id: "closing",
      startDate: "2026-09-13",
      endDate: "2026-09-13",
      registrationOpens: "2026-01-01T09:00:00",
      registrationCloses: "2026-09-24T17:00:00",
    });
    const closedComp = makeComp({
      id: "closed",
      startDate: "2026-09-13",
      endDate: "2026-09-13",
      registrationOpens: "2026-01-01T09:00:00",
      registrationCloses: "2026-08-01T17:00:00",
    });
    const tbcComp = makeComp({
      id: "tbc",
      startDate: "2026-09-13",
      endDate: "2026-09-13",
    });

    const mixed = marksForDay(
      [openComp, closingComp, closedComp, tbcComp],
      "2026-09-13",
      ["open"],
      now,
    );
    assert.equal(mixed.total, 4);
    assert.equal(mixed.enrolled, true);
    assert.equal(mixed.enrolledCount, 1);
    assert.deepEqual(mixed.statuses, [
      "closing-soon",
      "open",
      "closed",
      "unknown",
    ]);

    const empty = marksForDay([], "2026-09-13", [], now);
    assert.equal(empty.total, 0);
    assert.equal(empty.enrolled, false);
    assert.deepEqual(empty.statuses, []);
  });
});
