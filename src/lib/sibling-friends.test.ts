import assert from "node:assert/strict";
import { test } from "node:test";
import {
  friendlySiblingFriendsError,
  parseSiblingFriendDirectory,
  siblingDirectoryHasPrivateFields,
} from "./sibling-friends";

const mia = "11111111-1111-4111-8111-111111111111";
const leo = "22222222-2222-4222-8222-222222222222";
const friendship = "33333333-3333-4333-8333-333333333333";

test("sibling directory keeps first names and drops emails", () => {
  const raw = {
    can_add: true,
    viewer_role: "dancer",
    suggest: [
      { user_id: leo, label: "Leo", email: "leo@example.com" },
      { user_id: "not-a-user", label: "Skip" },
    ],
    incoming: [
      {
        user_id: mia,
        label: "mia@studio.test",
        friendship_id: friendship,
        dob: "2014-01-01",
      },
    ],
    outgoing: [{ user_id: leo, label: "Leo", friendship_id: "" }],
    friends: [],
  };
  assert.equal(siblingDirectoryHasPrivateFields(raw), true);
  const directory = parseSiblingFriendDirectory(raw);
  assert.equal(directory.canAdd, true);
  assert.equal(directory.suggest.length, 1);
  assert.equal(directory.suggest[0]?.label, "Leo");
  assert.equal(directory.incoming[0]?.label, "Dancer");
  assert.equal(directory.outgoing.length, 0);
  const text = JSON.stringify(directory);
  assert.equal(text.includes("@"), false);
  assert.equal(text.includes("email"), false);
  assert.equal(text.includes("2014-01-01"), false);
});

test("a parent login cannot add siblings from this directory", () => {
  const directory = parseSiblingFriendDirectory({
    can_add: false,
    viewer_role: "parent",
    suggest: [{ user_id: leo, label: "Leo" }],
  });
  assert.equal(directory.canAdd, false);
  assert.equal(directory.suggest.length, 0);
});

test("missing sibling SQL is explained in plain English", () => {
  assert.match(
    friendlySiblingFriendsError("Could not find the function public.list_family_siblings"),
    /sibling friends SQL/,
  );
  assert.equal(
    friendlySiblingFriendsError("Parents and dancers cannot be friends"),
    "Parents and dancers cannot be friends.",
  );
  assert.equal(
    friendlySiblingFriendsError("You can only add a sibling in your family"),
    "You can only add a sibling who has their own dancer login in your family.",
  );
  assert.equal(
    friendlySiblingFriendsError("Siblings must both be dancer logins"),
    "Siblings must both be dancer logins in this family.",
  );
});
