import assert from "node:assert/strict";
import { test } from "node:test";
import { kidsSectionLabel, myDancersLabel } from "./copy";

test("myDancersLabel is My Dancers for zero or many, My Dancer for one", () => {
  assert.equal(myDancersLabel(0), "My Dancers");
  assert.equal(myDancersLabel(1), "My Dancer");
  assert.equal(myDancersLabel(2), "My Dancers");
});

test("dancers see My Info; guests, parents, and studios keep myDancersLabel", () => {
  assert.equal(kidsSectionLabel("dancer", 0), "My Info");
  assert.equal(kidsSectionLabel("dancer", 1), "My Info");
  assert.equal(kidsSectionLabel("dancer", 4), "My Info");
  assert.equal(kidsSectionLabel("parent", 0), "My Dancers");
  assert.equal(kidsSectionLabel("parent", 1), "My Dancer");
  assert.equal(kidsSectionLabel("parent", 2), "My Dancers");
  assert.equal(kidsSectionLabel("studio", 1), "My Dancer");
  assert.equal(kidsSectionLabel(null, 0), "My Dancers");
  assert.equal(kidsSectionLabel(undefined, 1), "My Dancer");
});
