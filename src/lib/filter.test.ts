import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareCompsByDate,
  compDateSortKey,
  compIsUpcoming,
  filterComps,
  matchesChild,
  matchesHomeState,
  resolveHomeState,
} from "./filter";
import { adelaideToday } from "./datetime";
import { derivePreferredState } from "./storage";
import { formatCompLocation } from "./comps";
import type { ChildProfile, Competition } from "./types";

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

const saChild: ChildProfile = {
  id: "mia",
  name: "Mia",
  dob: "2018-06-15",
  styles: ["Jazz"],
  studio: "Studio",
  homeState: "SA",
};

const saComp = makeComp({ id: "sa-local", state: "SA", name: "Adelaide Jazz" });
const nswComp = makeComp({
  id: "nsw-local",
  state: "NSW",
  name: "Sydney Jazz",
});
const vicComp = makeComp({
  id: "vic-local",
  state: "VIC",
  name: "Melbourne Jazz",
});
const qldNational = makeComp({
  id: "qld-nationals",
  state: "QLD",
  name: "National Finals",
  kind: "nationals",
  isNational: true,
});
const saBallet = makeComp({
  id: "sa-ballet",
  state: "SA",
  name: "Adelaide Ballet",
  styles: ["Ballet"],
});
const saTinyTots = makeComp({
  id: "sa-tiny",
  state: "SA",
  name: "Tiny Tots",
  minAge: 3,
  maxAge: 5,
});

const catalogue = [
  saComp,
  nswComp,
  vicComp,
  qldNational,
  saBallet,
  saTinyTots,
];

describe("matchesHomeState", () => {
  it("keeps home-state comps and nationals when interstate is off", () => {
    assert.equal(matchesHomeState(saComp, "SA", false), true);
    assert.equal(matchesHomeState(qldNational, "SA", false), true);
    assert.equal(matchesHomeState(nswComp, "SA", false), false);
    assert.equal(matchesHomeState(vicComp, "SA", false), false);
  });

  it("includes other states when interstate is on", () => {
    assert.equal(matchesHomeState(nswComp, "SA", true), true);
    assert.equal(matchesHomeState(vicComp, "SA", true), true);
  });

  it("matches nothing when interstate is off and no home state is known", () => {
    assert.equal(matchesHomeState(saComp, null, false), false);
    assert.equal(matchesHomeState(qldNational, null, false), false);
  });
});

describe("filterComps — selected child", () => {
  it("SA child sees SA + national, not NSW/VIC", () => {
    const ids = filterComps(catalogue, {
      query: "",
      includeInterstate: false,
      child: saChild,
    }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["qld-nationals", "sa-local"]);
    assert.ok(!ids.includes("nsw-local"));
    assert.ok(!ids.includes("vic-local"));
  });

  it("SA child with interstate on also sees other states that fit age and style", () => {
    const ids = filterComps(catalogue, {
      query: "",
      includeInterstate: true,
      child: saChild,
    }).map((c) => c.id);
    assert.ok(ids.includes("sa-local"));
    assert.ok(ids.includes("nsw-local"));
    assert.ok(ids.includes("vic-local"));
    assert.ok(ids.includes("qld-nationals"));
    assert.ok(!ids.includes("sa-ballet"));
    assert.ok(!ids.includes("sa-tiny"));
  });

  it("still applies age and style filters", () => {
    assert.equal(matchesChild(saBallet, saChild, false), false);
    assert.equal(matchesChild(saTinyTots, saChild, false), false);
    assert.equal(matchesChild(saComp, saChild, false), true);
    assert.equal(matchesChild(qldNational, saChild, false), true);
  });
});

describe("filterComps — Everyone / no child", () => {
  it("uses preferred home state instead of dumping Australia-wide", () => {
    const ids = filterComps(catalogue, {
      query: "",
      includeInterstate: false,
      child: null,
      homeState: "SA",
    }).map((c) => c.id);
    assert.deepEqual(ids.sort(), ["qld-nationals", "sa-ballet", "sa-local", "sa-tiny"]);
    assert.ok(!ids.includes("nsw-local"));
    assert.ok(!ids.includes("vic-local"));
  });

  it("returns no comps when no state is chosen and interstate is off", () => {
    const ids = filterComps(catalogue, {
      query: "",
      includeInterstate: false,
      child: null,
      homeState: null,
    }).map((c) => c.id);
    assert.deepEqual(ids, []);
  });

  it("shows every state when interstate is on", () => {
    const ids = filterComps(catalogue, {
      query: "",
      includeInterstate: true,
      child: null,
      homeState: null,
    }).map((c) => c.id);
    assert.equal(ids.length, catalogue.length);
  });
});

describe("resolveHomeState", () => {
  it("prefers the selected child’s home state", () => {
    assert.equal(resolveHomeState(saChild, "NSW"), "SA");
    assert.equal(resolveHomeState(null, "NSW"), "NSW");
    assert.equal(resolveHomeState(null, null), null);
  });
});

describe("derivePreferredState", () => {
  it("uses a stored preferred state first", () => {
    assert.equal(
      derivePreferredState({
        preferredState: "VIC",
        children: [saChild],
        selectedChildId: saChild.id,
      }),
      "VIC",
    );
  });

  it("falls back to the selected child, then the first child", () => {
    assert.equal(
      derivePreferredState({
        children: [saChild],
        selectedChildId: saChild.id,
      }),
      "SA",
    );
    assert.equal(
      derivePreferredState({
        children: [{ ...saChild, homeState: "QLD" }],
        selectedChildId: null,
      }),
      "QLD",
    );
    assert.equal(derivePreferredState({ children: [] }), null);
  });
});

describe("compDateSortKey", () => {
  it("prefers start date, then end, then registration dates", () => {
    assert.equal(
      compDateSortKey(makeComp({ id: "a", startDate: "2026-06-01" })),
      "2026-06-01",
    );
    assert.equal(
      compDateSortKey(makeComp({ id: "b", startDate: "", endDate: "2026-07-01" })),
      "2026-07-01",
    );
    assert.equal(
      compDateSortKey(
        makeComp({
          id: "c",
          startDate: "",
          endDate: "",
          registrationOpens: "2026-03-01T09:00:00",
        }),
      ),
      "2026-03-01T09:00:00",
    );
    assert.equal(compDateSortKey(makeComp({ id: "e", startDate: "", endDate: "" })), "");
  });
});

describe("compareCompsByDate", () => {
  const now = new Date("2026-09-21T12:00:00+09:30");
  const early = makeComp({
    id: "early",
    startDate: "2026-02-12",
    endDate: "2026-02-12",
    name: "Early",
  });
  const soon = makeComp({
    id: "soon",
    startDate: "2026-09-25",
    endDate: "2026-09-26",
    name: "Soon",
  });
  const late = makeComp({
    id: "late",
    startDate: "2026-11-07",
    endDate: "2026-11-08",
    name: "Late",
  });
  const yesterday = makeComp({
    id: "yesterday",
    startDate: "2026-09-20",
    endDate: "2026-09-20",
    name: "Yesterday",
  });
  const undated = makeComp({
    id: "undated",
    startDate: "",
    endDate: "",
    name: "TBC",
  });

  it("treats today in Australia/Adelaide as the upcoming cutoff", () => {
    assert.equal(adelaideToday(now), "2026-09-21");
    assert.equal(compIsUpcoming(soon, "2026-09-21"), true);
    assert.equal(compIsUpcoming(early, "2026-09-21"), false);
    assert.equal(
      compIsUpcoming(
        makeComp({
          id: "today",
          startDate: "2026-09-21",
          endDate: "2026-09-21",
        }),
        "2026-09-21",
      ),
      true,
    );
  });

  it("does not treat an already-started multi-day comp as upcoming", () => {
    const ongoing = makeComp({
      id: "ongoing",
      startDate: "2026-09-19",
      endDate: "2026-09-22",
    });
    assert.equal(compIsUpcoming(ongoing, "2026-09-21"), false);
    assert.ok(compareCompsByDate(soon, ongoing, "asc", now) < 0);
  });

  it("soonest first: nearest upcoming start, then past by most recent", () => {
    assert.ok(compareCompsByDate(soon, late, "asc", now) < 0);
    assert.ok(compareCompsByDate(late, early, "asc", now) < 0);
    assert.ok(compareCompsByDate(yesterday, early, "asc", now) < 0);
    assert.ok(compareCompsByDate(soon, yesterday, "asc", now) < 0);
  });

  it("latest first: farthest upcoming start, then past by most recent", () => {
    assert.ok(compareCompsByDate(late, soon, "desc", now) < 0);
    assert.ok(compareCompsByDate(soon, yesterday, "desc", now) < 0);
    assert.ok(compareCompsByDate(yesterday, early, "desc", now) < 0);
  });

  it("puts undated comps last in both directions", () => {
    assert.ok(compareCompsByDate(undated, soon, "asc", now) > 0);
    assert.ok(compareCompsByDate(undated, late, "desc", now) > 0);
    assert.ok(compareCompsByDate(undated, early, "asc", now) > 0);
  });
});

describe("filterComps sort", () => {
  const now = new Date("2026-09-21T12:00:00+09:30");
  const comps = [
    makeComp({
      id: "late",
      startDate: "2026-11-07",
      endDate: "2026-11-08",
      name: "November Jazz",
      styles: ["Jazz"],
    }),
    makeComp({
      id: "early",
      startDate: "2026-02-12",
      endDate: "2026-02-13",
      name: "February Jazz",
      styles: ["Jazz"],
    }),
    makeComp({
      id: "mid-past",
      startDate: "2026-06-06",
      endDate: "2026-06-07",
      name: "June Jazz",
      styles: ["Jazz"],
    }),
    makeComp({
      id: "soon",
      startDate: "2026-09-25",
      endDate: "2026-09-26",
      name: "September Jazz",
      styles: ["Jazz"],
    }),
    makeComp({
      id: "ballet-past",
      startDate: "2026-03-01",
      endDate: "2026-03-01",
      name: "March Ballet",
      styles: ["Ballet"],
    }),
  ];

  it("soonest first lists nearest upcoming before any past comps", () => {
    const result = filterComps(comps, {
      query: "jazz",
      includeInterstate: true,
      child: null,
      now,
    });
    assert.deepEqual(
      result.map((c) => c.id),
      ["soon", "late", "mid-past", "early"],
    );
  });

  it("latest first lists farthest upcoming, then past by most recent", () => {
    const result = filterComps(comps, {
      query: "jazz",
      includeInterstate: true,
      child: null,
      sortDir: "desc",
      now,
    });
    assert.deepEqual(
      result.map((c) => c.id),
      ["late", "soon", "mid-past", "early"],
    );
  });

  it("uses Adelaide today when UTC is still yesterday", () => {
    const utcYesterday = new Date("2026-09-20T14:30:00.000Z");
    const result = filterComps(
      [
        makeComp({
          id: "today-comp",
          startDate: "2026-09-21",
          endDate: "2026-09-21",
          name: "Today Jazz",
          styles: ["Jazz"],
        }),
        makeComp({
          id: "yesterday-comp",
          startDate: "2026-09-20",
          endDate: "2026-09-20",
          name: "Yesterday Jazz",
          styles: ["Jazz"],
        }),
      ],
      {
        query: "",
        includeInterstate: true,
        child: null,
        now: utcYesterday,
      },
    );
    assert.deepEqual(
      result.map((c) => c.id),
      ["today-comp", "yesterday-comp"],
    );
  });
});

describe("filterComps registration status", () => {
  const now = new Date("2026-06-01T12:00:00+09:30");
  const comps = [
    makeComp({
      id: "open",
      startDate: "2026-08-01",
      name: "Open Jazz SA",
      styles: ["Jazz"],
      registrationOpens: "2026-05-01T09:00:00",
      registrationCloses: "2026-07-15T17:00:00",
    }),
    makeComp({
      id: "closing",
      startDate: "2026-09-01",
      name: "Closing Jazz SA",
      styles: ["Jazz"],
      registrationOpens: "2026-05-01T09:00:00",
      registrationCloses: "2026-06-05T17:00:00",
    }),
    makeComp({
      id: "closed",
      startDate: "2026-04-01",
      name: "Closed Jazz SA",
      styles: ["Jazz"],
      registrationOpens: "2026-01-01T09:00:00",
      registrationCloses: "2026-05-15T17:00:00",
    }),
    makeComp({
      id: "unknown",
      startDate: "2026-10-01",
      name: "TBC Jazz SA",
      styles: ["Jazz"],
    }),
    makeComp({
      id: "vic-open",
      startDate: "2026-11-01",
      name: "Open Jazz VIC",
      styles: ["Jazz"],
      state: "VIC",
      registrationOpens: "2026-05-01T09:00:00",
      registrationCloses: "2026-07-15T17:00:00",
    }),
  ];

  it("filters to selected statuses and keeps date sort", () => {
    const result = filterComps(comps, {
      query: "",
      includeInterstate: true,
      child: null,
      statuses: ["open", "closing-soon"],
      sortDir: "desc",
      now,
    });
    assert.deepEqual(
      result.map((c) => c.id),
      ["vic-open", "closing", "open"],
    );
  });

  it("treats unknown as Dates TBC and works with home-state filter", () => {
    const child = {
      id: "kid",
      name: "Ava",
      dob: "2018-06-15",
      styles: ["Jazz" as const],
      studio: "",
      homeState: "SA" as const,
    };
    const tbcHome = filterComps(comps, {
      query: "",
      includeInterstate: false,
      child,
      statuses: ["unknown"],
      now,
    });
    assert.deepEqual(
      tbcHome.map((c) => c.id),
      ["unknown"],
    );
  });

  it("shows all statuses when the list is empty", () => {
    const result = filterComps(comps, {
      query: "",
      includeInterstate: true,
      child: null,
      statuses: [],
      now,
    });
    assert.equal(result.length, comps.length);
  });
});

describe("formatCompLocation", () => {
  it("joins venue, suburb and state, skipping a duplicate suburb", () => {
    assert.equal(
      formatCompLocation({
        venue: "Golden Grove Recreation & Arts Centre",
        suburb: "Golden Grove",
        state: "SA",
      }),
      "Golden Grove Recreation & Arts Centre, Golden Grove, SA",
    );
    assert.equal(
      formatCompLocation({
        venue: "Golden Grove",
        suburb: "Golden Grove",
        state: "SA",
      }),
      "Golden Grove, SA",
    );
    assert.equal(
      formatCompLocation({
        venue: "Adelaide (venue confirmed closer to the event)",
        suburb: "Adelaide",
        state: "SA",
      }),
      "Adelaide (venue confirmed closer to the event), Adelaide, SA",
    );
  });
});
