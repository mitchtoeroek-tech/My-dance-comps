import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterComps,
  matchesChild,
  matchesHomeState,
  resolveHomeState,
} from "./filter";
import { derivePreferredState } from "./storage";
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
