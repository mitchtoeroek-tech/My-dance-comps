import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { registrationStatus, normalizeCompetitions } from "./comps";
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
    reminderPrefs: { onOpen: false, weekBeforeClose: "nope" },
    results: [{ id: "r1", childId: "ok", compName: "Nationals" }, { id: "bad" }],
  });

  assert.equal(normalized.version, 1);
  assert.equal("extra" in normalized, false);
  assert.equal(normalized.includeInterstate, false);
  assert.equal(normalized.children.length, 2);
  assert.deepEqual(normalized.children[1]?.styles, []);
  assert.equal(normalized.selectedChildId, null);
  assert.deepEqual(normalized.favourites, ["a", "b"]);
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
  });
  const loaded = loadFamilyState();
  assert.equal(loaded.includeInterstate, true);
  assert.equal(loaded.children[0]?.name, "Mia");
  assert.equal(loaded.selectedChildId, "c1");
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
