import assert from "node:assert/strict";
import { test } from "node:test";
import {
  directoryHasPrivateFields,
  emptyStudioFriendDirectory,
  friendlyStudioFriendsError,
  parseStudioFriendDirectory,
  parseStudioFriendInbox,
  safeFriendLabel,
  studioFriendIntro,
} from "./studio-friends";

const parentA = "11111111-1111-4111-8111-111111111111";
const parentB = "22222222-2222-4222-8222-222222222222";
const friendship = "33333333-3333-4333-8333-333333333333";
const studio = "44444444-4444-4444-8444-444444444444";

test("safe friend labels never keep an email", () => {
  assert.equal(safeFriendLabel("Parent of Mia and Leo", "Parent"), "Parent of Mia and Leo");
  assert.equal(safeFriendLabel("  Mia  Rose  ", "Dancer"), "Mia Rose");
  assert.equal(safeFriendLabel("mia@studio.test", "Dancer"), "Dancer");
  assert.equal(safeFriendLabel("", "Parent"), "Parent");
  assert.equal(safeFriendLabel(null, "Parent"), "Parent");
});

test("studio friend directory drops emails and keeps role-locked rows", () => {
  const raw = {
    studio_name: "Mint Studio",
    viewer_role: "parent",
    can_add: true,
    suggest: [
      {
        user_id: parentB,
        label: "Parent of Mia and Leo",
        email: "other@example.com",
      },
      { user_id: "not-a-user", label: "Skip" },
    ],
    incoming: [
      {
        user_id: parentA,
        label: "parent@example.com",
        friendship_id: friendship,
        dob: "2014-01-01",
      },
    ],
    outgoing: [{ user_id: parentB, label: "Parent of Zoe", friendship_id: "" }],
    friends: [],
  };
  assert.equal(directoryHasPrivateFields(raw), true);
  const directory = parseStudioFriendDirectory(raw);
  assert.equal(directory.studioName, "Mint Studio");
  assert.equal(directory.viewerRole, "parent");
  assert.equal(directory.canAdd, true);
  assert.equal(directory.suggest.length, 1);
  assert.equal(directory.suggest[0]?.label, "Parent of Mia and Leo");
  assert.equal(directory.incoming[0]?.label, "Parent");
  assert.equal(directory.outgoing.length, 0);
  const text = JSON.stringify(directory);
  assert.equal(text.includes("@"), false);
  assert.equal(text.includes("email"), false);
  assert.equal(text.includes("2014-01-01"), false);
  assert.match(studioFriendIntro("parent", "Mint Studio"), /other parents/);
  assert.match(studioFriendIntro("dancer", "Mint Studio"), /first names/);
  assert.match(studioFriendIntro("studio", "Mint Studio"), /parent and dancer/);
});

test("a studio owner cannot add friends from the directory", () => {
  const directory = parseStudioFriendDirectory({
    studio_name: "owner@studio.test",
    viewer_role: "studio",
    can_add: true,
    suggest: [{ user_id: parentA, label: "Parent of Mia" }],
  });
  assert.equal(directory.canAdd, false);
  assert.equal(directory.viewerRole, "studio");
  assert.equal(directory.studioName, "Studio");
  assert.equal(directory.suggest.length, 0);
  assert.deepEqual(emptyStudioFriendDirectory().friends, []);
});

test("friend inbox keeps accepted studio threads and hides emails", () => {
  const inbox = parseStudioFriendInbox({
    incoming_count: 2,
    threads: [
      {
        friendship_id: friendship,
        studio_id: studio,
        studio_name: "Mint Studio",
        label: "Mia",
        email: "mia@example.com",
      },
      {
        friendship_id: friendship,
        studio_id: studio,
        studio_name: "Mint Studio",
        label: "Mia",
      },
      {
        friendship_id: "nope",
        studio_id: studio,
        studio_name: "Mint Studio",
        label: "Skip",
      },
    ],
  });
  assert.equal(inbox.incomingCount, 2);
  assert.equal(inbox.threads.length, 1);
  assert.equal(inbox.threads[0]?.label, "Mia");
  assert.equal(JSON.stringify(inbox).includes("@"), false);
});

test("missing studio-friends SQL is explained in plain English", () => {
  assert.match(
    friendlyStudioFriendsError(
      "Could not find the function public.list_studio_friends",
    ),
    /studio friends SQL/,
  );
  assert.equal(
    friendlyStudioFriendsError("Parents can only add other parents"),
    "Parents can only add other parents at this studio.",
  );
  assert.equal(
    friendlyStudioFriendsError("Dancers can only add other dancers"),
    "Dancers can only add other dancers at this studio.",
  );
  assert.equal(
    friendlyStudioFriendsError("Parents and dancers cannot be friends"),
    "Parents and dancers cannot be friends.",
  );
  assert.equal(
    friendlyStudioFriendsError("You can only add people at this studio"),
    "You can only add people at this studio.",
  );
});
