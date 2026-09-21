import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  registrationStatus,
  normalizeCompetitions,
  unionCompetitions,
} from "./comps";
import {
  formatDateRange,
  formatDateTime,
  parseAdelaide,
} from "./datetime";
import { filterComps } from "./filter";
import { remindersForComp } from "./reminders";
import {
  defaultFamilyState,
  defaultReminderPrefs,
  loadFamilyState,
  normalizeFamilyState,
  saveFamilyState,
  STORAGE_KEY,
} from "./storage";
import {
  defaultReviewsState,
  loadReviewsState,
  REVIEWS_STORAGE_KEY,
  saveReviewsState,
} from "./reviews";
import { persistReview } from "./reviews-backend";
import type { Competition } from "./types";

const memory = new Map<string, string>();

const localStorageMock = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, String(value));
  },
  removeItem(key: string) {
    memory.delete(key);
  },
};

Object.defineProperty(globalThis, "window", {
  value: { localStorage: localStorageMock },
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

afterEach(() => {
  memory.clear();
});

const sampleComp: Competition = {
  id: "test-comp",
  name: "Test Comp",
  kind: "competition",
  organiser: "Org",
  organiserUrl: "",
  venue: "Hall",
  suburb: "Adelaide",
  state: "SA",
  startDate: "2026-09-01",
  endDate: "2026-09-02",
  registrationOpens: null,
  registrationCloses: null,
  registrationUrl: "",
  infoUrl: "",
  styles: ["Jazz"],
  minAge: 5,
  maxAge: 18,
  isNational: false,
  notes: "",
  sourceId: "test",
  lastUpdated: "2026-09-21",
};

test("normalizeFamilyState drops corrupt children and unknown fields", () => {
  const normalized = normalizeFamilyState({
    version: 99,
    extra: true,
    includeInterstate: "yes",
    children: [
      { id: "ok", name: "Mia", dob: "2018-06-15", styles: ["Jazz"], homeState: "SA" },
      { name: "missing id" },
      null,
      { id: "no-name", name: "   " },
      { id: "styles-missing", name: "Leo", dob: "2016-01-01", homeState: "VIC" },
    ],
    selectedChildId: "ghost",
    favourites: ["a", 1, "b"],
    enrolled: ["entered", 9, "also"],
    enrolledByChild: { ok: ["entered", 4], ghost: ["nope"] },
    reminderPrefs: { onOpen: false, weekBeforeClose: "nope" },
    results: [{ id: "r1", childId: "ok", compName: "Nationals" }, { id: "bad" }],
  });

  assert.equal(normalized.version, 1);
  assert.equal("extra" in normalized, false);
  assert.equal(normalized.includeInterstate, false);
  assert.equal(normalized.preferredState, "SA");
  assert.equal(normalized.children.length, 2);
  assert.deepEqual(normalized.children[1]?.styles, []);
  assert.equal(normalized.selectedChildId, null);
  assert.deepEqual(normalized.favourites, ["a", "b"]);
  assert.deepEqual(normalized.enrolled, ["entered", "also"]);
  assert.deepEqual(normalized.enrolledByChild, { ok: ["entered"] });
  assert.equal(normalized.reminderPrefs.onOpen, false);
  assert.equal(normalized.reminderPrefs.weekBeforeClose, true);
  assert.equal(normalized.results.length, 1);
});

test("loadFamilyState wipes corrupt JSON instead of throwing", () => {
  memory.set(STORAGE_KEY, "{not json");
  const loaded = loadFamilyState();
  assert.deepEqual(loaded, defaultFamilyState);
  assert.equal(memory.has(STORAGE_KEY), false);
});

test("saveFamilyState round-trips a valid family without throwing in private mode", () => {
  saveFamilyState({
    ...defaultFamilyState,
    includeInterstate: true,
    children: [
      {
        id: "c1",
        name: "Mia",
        dob: "2018-06-15",
        styles: ["Tap"],
        studio: "",
        homeState: "SA",
      },
    ],
    selectedChildId: "c1",
    favourites: ["test-comp"],
    enrolled: ["test-comp"],
    enrolledByChild: { c1: ["test-comp", "other"] },
  });
  const loaded = loadFamilyState();
  assert.equal(loaded.includeInterstate, true);
  assert.equal(loaded.children[0]?.name, "Mia");
  assert.equal(loaded.selectedChildId, "c1");
  assert.deepEqual(loaded.enrolled, ["test-comp"]);
  assert.deepEqual(loaded.enrolledByChild, { c1: ["test-comp", "other"] });
});

test("legacy family JSON without enrolledByChild still loads enrolled ids", () => {
  memory.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      children: [
        {
          id: "c1",
          name: "Mia",
          dob: "2018-06-15",
          styles: ["Jazz"],
          homeState: "SA",
        },
      ],
      selectedChildId: "c1",
      favourites: [],
      enrolled: ["old-comp"],
    }),
  );
  const loaded = loadFamilyState();
  assert.deepEqual(loaded.enrolled, ["old-comp"]);
  assert.deepEqual(loaded.enrolledByChild, {});
});

test("null and invalid registration dates never throw", () => {
  assert.equal(parseAdelaide(null), null);
  assert.equal(parseAdelaide("TBC"), null);
  assert.equal(parseAdelaide("not-a-date"), null);
  assert.equal(formatDateRange(null, null), "Dates TBC");
  assert.equal(formatDateTime(null), "TBC");
  assert.equal(registrationStatus(sampleComp), "unknown");
  assert.doesNotThrow(() =>
    remindersForComp(sampleComp, defaultReminderPrefs),
  );
  assert.equal(remindersForComp(sampleComp, defaultReminderPrefs).length, 0);
});

test("scraped comps with missing styles still filter and sort", () => {
  const comps = normalizeCompetitions([
    { ...sampleComp, styles: undefined, registrationOpens: null },
    { id: "no-start", name: "Broken", styles: ["Jazz"] },
    sampleComp,
  ]);
  assert.equal(comps.length, 2);
  const filtered = filterComps(comps, {
    query: "jazz",
    includeInterstate: true,
    child: {
      id: "c1",
      name: "Mia",
      dob: "2018-06-15",
      styles: ["Jazz"],
      studio: "",
      homeState: "SA",
    },
  });
  assert.ok(filtered.length >= 1);
});

test("unionCompetitions keeps Full Out seeds when live API returns a stale subset", () => {
  const fullOut: Competition = {
    ...sampleComp,
    id: "full-out-state-finals-2026",
    name: "Full Out — State Finals",
    organiser: "Full Out",
    sourceId: "full-out",
    startDate: "2026-12-16",
    endDate: "2026-12-18",
  };
  const merged = unionCompetitions([fullOut, sampleComp], [sampleComp]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((row) => row.id === "full-out-state-finals-2026"));
});

test("loadReviewsState wipes corrupt JSON instead of throwing", () => {
  memory.set(REVIEWS_STORAGE_KEY, "{not json");
  const loaded = loadReviewsState();
  assert.deepEqual(loaded, defaultReviewsState);
  assert.equal(memory.has(REVIEWS_STORAGE_KEY), false);
});

test("persistReview upserts one guest review per competition in localStorage", async () => {
  await persistReview({
    competitionId: "test-comp",
    stars: 4,
    comment: "Ran on time",
  });
  await persistReview({
    competitionId: "test-comp",
    stars: 5,
    comment: "Even better the second thought",
  });
  const loaded = loadReviewsState();
  assert.equal(Object.keys(loaded.byCompetitionId).length, 1);
  assert.equal(loaded.byCompetitionId["test-comp"]?.stars, 5);
  assert.equal(loaded.byCompetitionId["test-comp"]?.comment, "Even better the second thought");
  assert.equal(loaded.byCompetitionId["test-comp"]?.userId, null);
});

test("saveReviewsState round-trips without throwing in private mode", () => {
  saveReviewsState({
    version: 1,
    byCompetitionId: {
      "test-comp": {
        id: "r1",
        competitionId: "test-comp",
        userId: null,
        displayName: null,
        stars: 3,
        comment: "",
        createdAt: "2026-09-21T00:00:00.000Z",
        updatedAt: "2026-09-21T00:00:00.000Z",
      },
    },
  });
  const loaded = loadReviewsState();
  assert.equal(loaded.byCompetitionId["test-comp"]?.stars, 3);
});
