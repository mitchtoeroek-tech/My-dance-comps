import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dancersEligibleToLink,
  isLinkedToStudio,
  planStudioLink,
  studioLinkedLabel,
  withStudioLink,
  withoutStudioLink,
} from "./studio-link";
import type { ChildProfile } from "./types";

const STUDIO_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function dancer(
  id: string,
  extras?: Partial<ChildProfile>,
): ChildProfile {
  return {
    id,
    name: id === "mia" ? "Mia" : id === "ava" ? "Ava" : "Noah",
    dob: "2016-04-02",
    styles: [],
    studio: "",
    studioId: null,
    homeState: "SA",
    ...extras,
  };
}

test("guests are asked to log in before linking a studio", () => {
  const plan = planStudioLink({
    signedIn: false,
    role: null,
    children: [dancer("mia")],
  });
  assert.deepEqual(plan, { kind: "guest" });
});

test("studio accounts do not link dancer profiles", () => {
  const plan = planStudioLink({
    signedIn: true,
    role: "studio",
    children: [dancer("mia")],
  });
  assert.deepEqual(plan, { kind: "studio" });
});

test("a parent with one dancer links that dancer directly", () => {
  const mia = dancer("mia");
  const plan = planStudioLink({
    signedIn: true,
    role: "parent",
    children: [mia],
  });
  assert.equal(plan.kind, "link");
  if (plan.kind !== "link") return;
  assert.deepEqual(plan.dancers, [mia]);
});

test("a parent with several dancers chooses who to link", () => {
  const plan = planStudioLink({
    signedIn: true,
    role: "parent",
    children: [dancer("mia"), dancer("ava")],
  });
  assert.equal(plan.kind, "link");
  if (plan.kind !== "link") return;
  assert.deepEqual(
    plan.dancers.map((child) => child.id),
    ["mia", "ava"],
  );
});

test("a parent with no dancers needs a profile first", () => {
  assert.deepEqual(
    planStudioLink({ signedIn: true, role: "parent", children: [] }),
    { kind: "needs-profile", role: "parent" },
  );
});

test("a dancer login links only their own profile", () => {
  const mia = dancer("mia");
  const plan = planStudioLink({
    signedIn: true,
    role: "dancer",
    children: [mia, dancer("ava")],
    linkedChildId: "mia",
    selectedChildId: "ava",
  });
  assert.equal(plan.kind, "link");
  if (plan.kind !== "link") return;
  assert.deepEqual(plan.dancers, [mia]);
});

test("a dancer without a family link uses their selected profile", () => {
  const ava = dancer("ava");
  assert.deepEqual(
    dancersEligibleToLink([dancer("mia"), ava], "dancer", null, "ava"),
    [ava],
  );
});

test("a dancer whose profile is missing is not offered a sibling", () => {
  assert.deepEqual(
    planStudioLink({
      signedIn: true,
      role: "dancer",
      children: [dancer("ava")],
      linkedChildId: "mia",
    }),
    { kind: "needs-profile", role: "dancer" },
  );
});

test("linking stores the approved studio and removing clears only that link", () => {
  const mia = dancer("mia", { studio: "Local hall", studioId: null });
  const linked = withStudioLink(mia, { id: STUDIO_ID, name: "Mint Studio" });
  assert.equal(linked.studioId, STUDIO_ID);
  assert.equal(linked.studio, "Mint Studio");
  assert.equal(isLinkedToStudio(linked, STUDIO_ID), true);

  const removed = withoutStudioLink(linked, STUDIO_ID);
  assert.equal(removed.studioId, null);
  assert.equal(removed.studio, "Mint Studio");

  const other = dancer("ava", { studio: "Other", studioId: OTHER_ID });
  assert.equal(withoutStudioLink(other, STUDIO_ID), other);
});

test("linked confirmation uses Australian studio wording", () => {
  assert.equal(studioLinkedLabel("Mint Studio"), "Linked to Mint Studio.");
  assert.equal(
    studioLinkedLabel("Mint Studio", "Mia"),
    "Mia — Linked to Mint Studio.",
  );
  assert.equal(studioLinkedLabel("  "), "Linked to this studio.");
});
