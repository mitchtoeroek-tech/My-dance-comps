import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  dancerLoginEmail,
  displayFamilyCode,
  loginIdentifierToEmail,
  normalizeDancerUsername,
  resolveAccountRole,
} from "./account";
import { defaultFamilyState } from "./storage";
import { toggleEnrollment } from "./enrolled";
import {
  dancerPushPayload,
  familyStateFromDancerSnapshot,
  reconcileDancerLinkedState,
  scopeDancerFamily,
} from "./family-sync";
import type { ChildProfile, FamilyState } from "./types";

const mia: ChildProfile = {
  id: "mia",
  name: "Mia",
  dob: "2018-06-15",
  styles: ["Jazz"],
  studio: "Mint",
  homeState: "SA",
};

function family(partial: Partial<FamilyState>): FamilyState {
  return { ...defaultFamilyState, ...partial };
}

test("dancer usernames become a stable login email", () => {
  assert.equal(normalizeDancerUsername("  Mia.T "), "mia.t");
  assert.equal(normalizeDancerUsername("ab"), null);
  assert.equal(normalizeDancerUsername("mia t"), null);
  assert.equal(
    dancerLoginEmail("mia.t"),
    "mia.t@dancers.mydancecomps.app",
  );
  assert.equal(loginIdentifierToEmail("Mia.T"), "mia.t@dancers.mydancecomps.app");
  assert.equal(
    loginIdentifierToEmail("parent@example.com"),
    "parent@example.com",
  );
});

test("resolveAccountRole keeps an explicit profile role", () => {
  assert.equal(resolveAccountRole("parent", "dancer"), "parent");
  assert.equal(resolveAccountRole("dancer", "parent"), "dancer");
  assert.equal(resolveAccountRole("studio", "parent"), "studio");
  assert.equal(resolveAccountRole("parent", "studio"), "parent");
  assert.equal(resolveAccountRole(null, "dancer"), "dancer");
  assert.equal(resolveAccountRole(null, "studio"), "studio");
  assert.equal(resolveAccountRole(undefined, undefined), "parent");
});

test("displayFamilyCode groups eight characters", () => {
  assert.equal(displayFamilyCode("ab12cd34"), "AB12-CD34");
  assert.equal(displayFamilyCode("ab12-cd34"), "AB12-CD34");
});

test("familyStateFromDancerSnapshot keeps family-wide enrolments until owned", () => {
  const parsed = familyStateFromDancerSnapshot({
    linked: true,
    child: {
      id: "mia",
      name: "Mia",
      dob: "2018-06-15",
      styles: ["Jazz"],
      studio: "Mint",
      home_state: "SA",
      linked_user_id: "dancer-1",
    },
    enrolled_owned: false,
    enrolled_ids: ["family-comp"],
    favourites: ["star"],
    results: [
      {
        id: "placing-1",
        comp_id: "comp-a",
        comp_name: "Adelaide Classic",
        date: "2026-08-01",
        section: "Jazz 8/U",
        placing: "2nd",
        score: "Gold",
        notes: "Strong finish",
      },
    ],
    include_interstate: false,
    preferred_state: "SA",
    reminder_prefs: { onOpen: true, weekBeforeClose: false, dayBeforeClose: true },
    notified_reminder_ids: [],
  });
  assert.equal(parsed.linked, true);
  assert.equal(parsed.state?.children.length, 1);
  assert.equal(parsed.state?.children[0]?.linkedUserId, "dancer-1");
  assert.deepEqual(parsed.state?.enrolled, ["family-comp"]);
  assert.equal(parsed.state && "favourites" in parsed.state, false);
  assert.equal(parsed.state?.enrolledByChild.mia, undefined);
  assert.equal(parsed.state?.selectedChildId, "mia");
  assert.equal(parsed.state?.results.length, 1);
  assert.equal(parsed.state?.results[0]?.childId, "mia");
  assert.equal(parsed.state?.results[0]?.placing, "2nd");
  assert.equal(parsed.state?.results[0]?.compName, "Adelaide Classic");
});

test("dancerPushPayload marks a per-dancer enrolled set only after one exists", () => {
  const shared = dancerPushPayload(
    family({
      children: [mia],
      selectedChildId: "mia",
      enrolled: ["family-comp"],
    }),
  );
  assert.equal(shared && "favourites" in shared, false);
  assert.equal(shared?.enrolled_owned, false);

  const owned = dancerPushPayload(
    family({
      children: [mia],
      enrolledByChild: { mia: ["mia-comp"] },
    }),
  );
  assert.equal(owned?.enrolled_owned, true);
  assert.deepEqual(owned?.enrolled_ids, ["mia-comp"]);
  const child = owned?.child as { home_state: string; studio_id: string | null };
  assert.equal(child.home_state, "SA");
  assert.equal(child.studio_id, null);

  const linkedStudio = dancerPushPayload(
    family({
      children: [
        {
          ...mia,
          studioId: "11111111-1111-4111-8111-111111111111",
        },
      ],
    }),
  );
  const linkedChild = linkedStudio?.child as { studio_id: string | null };
  assert.equal(linkedChild.studio_id, "11111111-1111-4111-8111-111111111111");
});

test("dancer push keeps an unenrol instead of the family-wide list", () => {
  const toggled = toggleEnrollment(["comp-a", "comp-b"], {}, "comp-a", "mia");
  const payload = dancerPushPayload(
    family({
      children: [mia],
      selectedChildId: "mia",
      enrolled: toggled.enrolled,
      enrolledByChild: toggled.enrolledByChild,
      results: [
        {
          id: "placing-1",
          childId: "mia",
          compId: "comp-b",
          compName: "Adelaide Classic",
          date: "2026-08-01",
          section: "Jazz 8/U",
          placing: "2nd",
          score: "",
          notes: "",
        },
        {
          id: "other-child",
          childId: "leo",
          compId: "comp-a",
          compName: "Other",
          date: "2026-07-01",
          section: "",
          placing: "1st",
          score: "",
          notes: "",
        },
      ],
    }),
  );
  assert.equal(payload?.enrolled_owned, true);
  assert.deepEqual(payload?.enrolled_ids, ["comp-b"]);
  const results = payload?.results as { id: string; placing: string }[];
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "placing-1");
  assert.equal(results[0]?.placing, "2nd");
});

test("reconcileDancerLinkedState uses the linked profile, not sibling rows", () => {
  const local = family({
    children: [{ ...mia, id: "draft", name: "Draft" }],
    enrolled: ["draft-comp"],
  });
  const remote = family({
    children: [mia],
    enrolledByChild: { mia: ["mia-comp"] },
    results: [
      {
        id: "placing-1",
        childId: "mia",
        compId: "comp-b",
        compName: "Adelaide Classic",
        date: "2026-08-01",
        section: "",
        placing: "2nd",
        score: "",
        notes: "",
      },
    ],
  });
  const next = reconcileDancerLinkedState(local, remote);
  assert.deepEqual(
    next.children.map((child) => child.id),
    ["mia"],
  );
  assert.equal(next.selectedChildId, "mia");
  assert.equal("favourites" in next, false);
  assert.deepEqual(next.enrolledByChild.mia, ["mia-comp"]);
  assert.equal(next.enrolled.includes("draft-comp"), false);
  assert.equal(next.results.length, 1);
  assert.equal(next.results[0]?.id, "placing-1");
  assert.equal(next.results[0]?.childId, "mia");
});

test("scopeDancerFamily locks a linked dancer to their own profile", () => {
  const scoped = scopeDancerFamily(
    family({
      children: [mia, { ...mia, id: "leo", name: "Leo" }],
      selectedChildId: null,
      results: [
        {
          id: "mia-result",
          childId: "mia",
          compId: "comp-a",
          compName: "Adelaide Classic",
          date: "2026-08-01",
          section: "",
          placing: "2nd",
          score: "",
          notes: "",
        },
        {
          id: "leo-result",
          childId: "leo",
          compId: "comp-b",
          compName: "Other",
          date: "2026-07-01",
          section: "",
          placing: "1st",
          score: "",
          notes: "",
        },
      ],
    }),
    { role: "dancer", linkedChildId: "mia" },
  );
  assert.deepEqual(
    scoped.children.map((child) => child.id),
    ["mia"],
  );
  assert.equal(scoped.selectedChildId, "mia");
  assert.deepEqual(
    scoped.results.map((result) => result.id),
    ["mia-result"],
  );

  const untouched = scopeDancerFamily(
    family({ children: [mia, { ...mia, id: "leo", name: "Leo" }] }),
    { role: "parent", linkedChildId: null },
  );
  assert.equal(untouched.children.length, 2);
});

test("dancer results SQL lets a linked dancer use their own placings", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20260927_dancer_results.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create or replace function public\.dancer_owns_child\(p_child_id text\)/);
  assert.match(sql, /p\.role = 'dancer'/);
  assert.match(sql, /c\.linked_user_id = p\.id/);
  assert.match(sql, /or public\.dancer_owns_child\(child_id\)/);
  assert.match(sql, /grant execute on function public\.dancer_owns_child\(text\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.dancer_owns_child\(text\) to anon/);
});
