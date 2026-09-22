import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultFamilyState } from "./storage";
import {
  isEmptyFamily,
  mergeFamilyState,
  parseHouseholdScope,
  reconcileFamilyState,
} from "./family-sync";
import { isSupabaseConfigured } from "./supabase";
import type { ChildProfile, FamilyState } from "./types";

const mia: ChildProfile = {
  id: "mia",
  name: "Mia",
  dob: "2018-06-15",
  styles: ["Jazz"],
  studio: "Mint",
  homeState: "SA",
};

const leo: ChildProfile = {
  id: "leo",
  name: "Leo",
  dob: "2016-01-01",
  styles: ["Tap"],
  studio: "",
  homeState: "VIC",
};

function family(partial: Partial<FamilyState>): FamilyState {
  return { ...defaultFamilyState, ...partial };
}

test("parseHouseholdScope uses the family owner and ignores a missing scope", () => {
  assert.deepEqual(
    parseHouseholdScope(
      { owner_id: "owner-1", family_id: "family-1" },
      "parent-2",
    ),
    { ownerId: "owner-1", familyId: "family-1" },
  );
  assert.deepEqual(parseHouseholdScope(null, "parent-1"), {
    ownerId: "parent-1",
    familyId: null,
  });
  assert.deepEqual(parseHouseholdScope({ owner_id: "", family_id: null }, "parent-1"), {
    ownerId: "parent-1",
    familyId: null,
  });
});

test("isSupabaseConfigured is false without public env vars", () => {
  assert.equal(isSupabaseConfigured(), false);
});

test("isEmptyFamily ignores prefs-only guest state", () => {
  assert.equal(isEmptyFamily(defaultFamilyState), true);
  assert.equal(
    isEmptyFamily(family({ includeInterstate: true, preferredState: "SA" })),
    true,
  );
  assert.equal(isEmptyFamily(family({ enrolled: ["comp-1"] })), false);
});

test("mergeFamilyState unions kids, enrolled and results", () => {
  const local = family({
    children: [mia],
    selectedChildId: "mia",
    enrolled: ["entered-local"],
    enrolledByChild: { mia: ["entered-local"] },
    results: [
      {
        id: "r1",
        childId: "mia",
        compId: null,
        compName: "Local",
        date: "2026-01-01",
        section: "",
        placing: "1st",
        score: "",
        notes: "",
      },
    ],
  });
  const remote = family({
    children: [{ ...mia, studio: "Remote Studio" }, leo],
    selectedChildId: "leo",
    enrolled: ["entered-remote"],
    enrolledByChild: { leo: ["entered-remote"] },
    includeInterstate: true,
    results: [
      {
        id: "r2",
        childId: "leo",
        compId: "comp-2",
        compName: "Remote",
        date: "2026-02-01",
        section: "",
        placing: "",
        score: "",
        notes: "",
      },
    ],
  });
  const merged = mergeFamilyState(local, remote);
  assert.equal(merged.children.length, 2);
  assert.equal(merged.children.find((c) => c.id === "mia")?.studio, "Mint");
  assert.ok(merged.children.some((c) => c.id === "leo"));
  assert.equal("favourites" in merged, false);
  assert.deepEqual(
    new Set(merged.enrolled),
    new Set(["entered-local", "entered-remote"]),
  );
  assert.deepEqual(
    new Set(merged.enrolledByChild.mia),
    new Set(["entered-local"]),
  );
  assert.deepEqual(
    new Set(merged.enrolledByChild.leo),
    new Set(["entered-remote"]),
  );
  assert.equal(merged.results.length, 2);
  assert.equal(merged.selectedChildId, "mia");
  assert.equal(merged.includeInterstate, true);
});

test("reconcileFamilyState keeps guest data when remote is empty", () => {
  const local = family({ children: [mia], enrolled: ["kept"] });
  const next = reconcileFamilyState(local, null, null, "user-1");
  assert.equal(next.children[0]?.name, "Mia");
  assert.deepEqual(next.enrolled, ["kept"]);
});

test("reconcileFamilyState loads remote when switching accounts", () => {
  const local = family({ children: [mia], enrolled: ["keep-out"] });
  const remote = family({ children: [leo], enrolled: ["leo-comp"] });
  const next = reconcileFamilyState(local, remote, "other-user", "user-1");
  assert.equal(next.children[0]?.id, "leo");
  assert.deepEqual(next.enrolled, ["leo-comp"]);
});

test("reconcileFamilyState uses remote when local guest family is empty", () => {
  const remote = family({ children: [leo], enrolled: ["cloud"] });
  const next = reconcileFamilyState(
    defaultFamilyState,
    remote,
    null,
    "user-1",
  );
  assert.equal(next.children[0]?.id, "leo");
  assert.deepEqual(next.enrolled, ["cloud"]);
});
