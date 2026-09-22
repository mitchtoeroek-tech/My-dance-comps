import assert from "node:assert/strict";
import { test } from "node:test";
import type { Competition } from "./types";
import {
  displayFriendCode,
  emptyFriendsSnapshot,
  friendEnrolledComps,
  friendInvitePath,
  friendInviteShareText,
  friendInviteUrl,
  enrolledDancersFromDirectory,
  filterPeopleByQuery,
  friendRolesAllowed,
  friendlyFriendsError,
  GUEST_FRIENDS_BODY,
  GUEST_FRIENDS_TITLE,
  NO_STUDIO_FRIENDS_COPY,
  parseStudioFriendsDirectory,
  isValidFriendCode,
  loginPathWithNext,
  normalizeFriendCode,
  orderedChildPair,
  parseFriendLookups,
  parseFriendsSnapshot,
  safeInternalPath,
  snapshotHasPrivateFields,
} from "./friends";

const jazz: Competition = {
  id: "jazz-open",
  name: "Jazz Open",
  kind: "competition",
  organiser: "Mint",
  organiserUrl: "https://example.com",
  venue: "Town Hall",
  suburb: "Adelaide",
  state: "SA",
  startDate: "2026-12-01",
  endDate: "2026-12-02",
  registrationOpens: null,
  registrationCloses: null,
  registrationUrl: "https://example.com/enter",
  infoUrl: "https://example.com",
  styles: ["Jazz"],
  minAge: 5,
  maxAge: 18,
  isNational: false,
  notes: "",
  sourceId: "seed",
  lastUpdated: "2026-01-01",
};

const tap: Competition = {
  ...jazz,
  id: "tap-classic",
  name: "Tap Classic",
  startDate: "2026-11-10",
  endDate: "2026-11-11",
};

test("normalizeFriendCode strips dashes and spaces", () => {
  assert.equal(normalizeFriendCode(" abcd-efgh "), "ABCDEFGH");
  assert.equal(displayFriendCode("abcdefgh"), "ABCD-EFGH");
  assert.equal(isValidFriendCode("ABCD-EFGH"), true);
  assert.equal(isValidFriendCode("ABC"), false);
  assert.equal(isValidFriendCode("ABCD0EFG"), false);
});

test("orderedChildPair is stable and rejects same ids", () => {
  assert.deepEqual(orderedChildPair("mia", "ava"), { low: "ava", high: "mia" });
  assert.deepEqual(orderedChildPair("ava", "mia"), { low: "ava", high: "mia" });
  assert.equal(orderedChildPair("mia", "mia"), null);
});

test("invite link and share copy stay parent-friendly", () => {
  assert.equal(friendInvitePath("abcdefgh"), "/friends/join?code=ABCD-EFGH");
  assert.equal(
    friendInviteUrl("https://my-dance-comps.vercel.app/", "abcdefgh"),
    "https://my-dance-comps.vercel.app/friends/join?code=ABCD-EFGH",
  );
  assert.match(
    friendInviteShareText("Mia Rose", "abcdefgh"),
    /Add Mia Rose as a dance friend/,
  );
  assert.match(friendInviteShareText("Mia Rose", "abcdefgh"), /ABCD-EFGH/);
});

test("safeInternalPath blocks open redirects", () => {
  assert.equal(safeInternalPath("/friends/join?code=ABCD-EFGH"), "/friends/join?code=ABCD-EFGH");
  assert.equal(safeInternalPath("https://evil.test"), null);
  assert.equal(safeInternalPath("//evil.test"), null);
  assert.equal(loginPathWithNext("/friends/join?code=X"), "/login?next=%2Ffriends%2Fjoin%3Fcode%3DX");
});

test("parseFriendsSnapshot keeps enrolled ids and drops empty rows", () => {
  const snapshot = parseFriendsSnapshot({
    invite_code: "abcd-efgh",
    share_enrolled: false,
    friends: [
      {
        friendship_id: "f1",
        child_id: "ava",
        name: "Ava",
        enrolled_comp_ids: ["jazz-open", "tap-classic"],
      },
      { friendship_id: "", child_id: "skip", name: "Skip" },
    ],
    incoming: [{ friendship_id: "f2", child_id: "leo", name: "Leo" }],
    outgoing: [],
  });
  assert.equal(snapshot.inviteCode, "ABCDEFGH");
  assert.equal(snapshot.shareEnrolled, false);
  assert.equal(snapshot.friends.length, 1);
  assert.deepEqual(snapshot.friends[0]?.enrolledCompIds, [
    "jazz-open",
    "tap-classic",
  ]);
  assert.equal(snapshot.incoming[0]?.name, "Leo");
  assert.deepEqual(emptyFriendsSnapshot().friends, []);
});

test("friend lookups never need dob, email or favourites", () => {
  const matches = parseFriendLookups({
    matches: [
      {
        child_id: "ava",
        name: "Ava",
        dob: "2018-01-01",
        email: "hidden@example.com",
        user_id: "should-not-matter",
      },
    ],
  });
  assert.deepEqual(matches, [{ childId: "ava", name: "Ava" }]);
  assert.equal(
    JSON.stringify(matches).includes("2018-01-01"),
    false,
  );
  assert.equal(
    snapshotHasPrivateFields({
      friends: [{ name: "Ava", dob: "2018-01-01" }],
    }),
    true,
  );
  assert.equal(
    snapshotHasPrivateFields({
      invite_code: "ABCDEFGH",
      friends: [{ enrolled_comp_ids: ["jazz-open"] }],
    }),
    false,
  );
});

test("friend enrolled comps are the marked-entered list in date order", () => {
  const listed = friendEnrolledComps(
    [jazz, tap, { ...jazz, id: "not-entered" }],
    ["tap-classic", "jazz-open"],
    "asc",
  );
  assert.deepEqual(
    listed.map((comp) => comp.id),
    ["tap-classic", "jazz-open"],
  );
});

test("guest copy and missing-SQL errors are plain English", () => {
  assert.equal(GUEST_FRIENDS_TITLE, "Friends unlock when you sign in");
  assert.match(GUEST_FRIENDS_BODY, /marked Enrolled/);
  assert.match(GUEST_FRIENDS_BODY, /not their date of birth/);
  assert.equal(/favourites/i.test(GUEST_FRIENDS_BODY), false);
  assert.match(
    friendlyFriendsError("Could not find the function public.list_friends_for_child"),
    /friends SQL/,
  );
  assert.equal(friendlyFriendsError("You are already friends."), "You are already friends.");
  assert.match(NO_STUDIO_FRIENDS_COPY, /Link a dancer to a studio/);
  assert.match(GUEST_FRIENDS_BODY, /same account|other parents|other dancers|dance studio/);
});

const studioA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const friendshipA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("parent and dancer roles cannot friend each other", () => {
  assert.equal(friendRolesAllowed("parent", "parent"), true);
  assert.equal(friendRolesAllowed("dancer", "dancer"), true);
  assert.equal(friendRolesAllowed("parent", "dancer"), false);
  assert.equal(friendRolesAllowed("dancer", "parent"), false);
  assert.equal(friendRolesAllowed("studio", "parent"), false);
  assert.equal(friendRolesAllowed("parent", "studio"), false);
});

test("studio directory drops emails and keeps same-studio people", () => {
  const directory = parseStudioFriendsDirectory({
    role: "parent",
    studios: [
      {
        studio_id: studioA,
        studio_name: "Mint Studio",
        people: [
          {
            user_id: userA,
            label: "Parent of Mia",
            status: "none",
            email: "hidden@example.com",
            friendship_id: null,
          },
          {
            user_id: userB,
            label: "sam@example.com",
            status: "accepted",
            friendship_id: friendshipA,
            dancers: [
              {
                child_id: "mia",
                name: "Mia",
                enrolled_comp_ids: ["jazz-open"],
                email: "also-hidden@example.com",
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(directory.role, "parent");
  assert.equal(directory.studios[0]?.studioName, "Mint Studio");
  assert.equal(directory.studios[0]?.people[0]?.label, "Parent");
  assert.equal(directory.studios[0]?.people[1]?.label, "Parent of Mia");
  assert.equal(
    JSON.stringify(directory).includes("example.com"),
    false,
  );
  const enrolled = enrolledDancersFromDirectory(directory, studioA);
  assert.equal(enrolled[0]?.name, "Mia");
  assert.deepEqual(enrolled[0]?.enrolledCompIds, ["jazz-open"]);
  const searched = filterPeopleByQuery(
    directory.studios[0]?.people ?? [],
    "parent of",
  );
  assert.equal(searched.length, 1);
  assert.equal(searched[0]?.label, "Parent of Mia");
});
