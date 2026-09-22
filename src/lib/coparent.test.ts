import assert from "node:assert/strict";
import { test } from "node:test";
import { parentLeaveConfirmMessage, parentListLabel } from "./coparent";

test("parent leave copy keeps the family when another parent or a dancer login remains", () => {
  assert.match(
    parentLeaveConfirmMessage(1, 2),
    /other parent keeps the dancers/i,
  );
  assert.match(
    parentLeaveConfirmMessage(0, 1),
    /still has their own login/i,
  );
  assert.match(parentLeaveConfirmMessage(0, 0), /stay on this account/i);
});

test("parent list shows a display name, and marks you, without an email", () => {
  assert.equal(
    parentListLabel({ displayName: "Sarah Chen", isYou: true }),
    "Sarah Chen (you)",
  );
  assert.equal(
    parentListLabel({ displayName: "Alex", isYou: false }),
    "Alex",
  );
});
