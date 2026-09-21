import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dropChildEnrollment,
  enrolledIdsForChild,
  isCompEnrolled,
  normalizeEnrolledByChild,
  toggleEnrollment,
} from "./enrolled";

test("normalizeEnrolledByChild keeps known children and drops junk", () => {
  const normalized = normalizeEnrolledByChild(
    {
      mia: ["comp-a", 2, "comp-b"],
      ghost: ["comp-c"],
      leo: "nope",
    },
    ["mia", "leo"],
  );
  assert.deepEqual(normalized, { mia: ["comp-a", "comp-b"], leo: [] });
});

test("legacy family enrolled list is the fallback for each child", () => {
  const family = ["comp-a", "comp-b"];
  assert.deepEqual(enrolledIdsForChild(family, {}, "mia"), family);
  assert.equal(isCompEnrolled(family, {}, "comp-a", "mia"), true);
});

test("a child's own set replaces the family fallback", () => {
  const family = ["comp-a", "comp-b"];
  const byChild = { mia: ["comp-c"] };
  assert.deepEqual(enrolledIdsForChild(family, byChild, "mia"), ["comp-c"]);
  assert.deepEqual(enrolledIdsForChild(family, byChild, "leo"), family);
  assert.deepEqual(enrolledIdsForChild(family, byChild, null), [
    "comp-a",
    "comp-b",
    "comp-c",
  ]);
});

test("empty per-child set is not treated as missing", () => {
  assert.deepEqual(
    enrolledIdsForChild(["comp-a"], { mia: [] }, "mia"),
    [],
  );
});

test("toggle for a child copies the family list then applies the change", () => {
  const first = toggleEnrollment(["comp-a"], {}, "comp-b", "mia");
  assert.deepEqual(first.enrolled, ["comp-a"]);
  assert.deepEqual(first.enrolledByChild.mia, ["comp-a", "comp-b"]);

  const second = toggleEnrollment(
    first.enrolled,
    first.enrolledByChild,
    "comp-a",
    "mia",
  );
  assert.deepEqual(second.enrolledByChild.mia, ["comp-b"]);
  assert.deepEqual(second.enrolled, ["comp-a"]);
});

test("toggle with All dancers removes a comp from family and every child", () => {
  const next = toggleEnrollment(
    ["comp-a", "comp-b"],
    { mia: ["comp-a", "comp-c"], leo: ["comp-c"] },
    "comp-a",
    null,
  );
  assert.deepEqual(next.enrolled, ["comp-b"]);
  assert.deepEqual(next.enrolledByChild.mia, ["comp-c"]);
  assert.deepEqual(next.enrolledByChild.leo, ["comp-c"]);
});

test("toggle with All dancers adds to the family list only", () => {
  const next = toggleEnrollment(["comp-a"], { mia: ["comp-a"] }, "comp-b", null);
  assert.deepEqual(next.enrolled, ["comp-a", "comp-b"]);
  assert.deepEqual(next.enrolledByChild.mia, ["comp-a"]);
});

test("dropChildEnrollment removes that dancer's enrolled set", () => {
  assert.deepEqual(
    dropChildEnrollment({ mia: ["a"], leo: ["b"] }, "mia"),
    { leo: ["b"] },
  );
});
