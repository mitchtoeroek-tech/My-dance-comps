import assert from "node:assert/strict";
import { test } from "node:test";
import { myDancersLabel } from "./copy";

test("myDancersLabel is My Dancers for zero or many, My Dancer for one", () => {
  assert.equal(myDancersLabel(0), "My Dancers");
  assert.equal(myDancersLabel(1), "My Dancer");
  assert.equal(myDancersLabel(2), "My Dancers");
});
