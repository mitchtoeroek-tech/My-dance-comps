import assert from "node:assert/strict";
import { test } from "node:test";
import type { AcceptedFriend } from "./friends";
import {
  COMMUNITY_MESSAGE_MAX,
  communityMessagePreview,
  communityThreadPath,
  formatCommunityTime,
  friendlyCommunityError,
  COMMUNITY_GUIDELINES,
  GUEST_COMMUNITY_BODY,
  GUEST_COMMUNITY_TITLE,
  isCommunityFriendshipId,
  latestMessageByThread,
  mergeCommunityConversations,
  mergeCommunityMessages,
  parseCommunityMessage,
  parseCommunityMessages,
  sanitizeCommunityMessage,
} from "./community";

const threadA = "11111111-1111-4111-8111-111111111111";
const threadB = "22222222-2222-4222-8222-222222222222";

function friend(partial: Partial<AcceptedFriend> & Pick<AcceptedFriend, "friendshipId" | "name">): AcceptedFriend {
  return {
    childId: partial.childId ?? "ava",
    enrolledCompIds: partial.enrolledCompIds ?? [],
    friendshipId: partial.friendshipId,
    name: partial.name,
  };
}

test("friendship ids must be UUIDs", () => {
  assert.equal(isCommunityFriendshipId(threadA), true);
  assert.equal(isCommunityFriendshipId("not-a-uuid"), false);
  assert.equal(isCommunityFriendshipId(""), false);
  assert.equal(communityThreadPath(threadA), `/community/${threadA}`);
});

test("sanitizeCommunityMessage trims, keeps newlines, and caps length", () => {
  assert.equal(sanitizeCommunityMessage("   "), null);
  assert.equal(sanitizeCommunityMessage(" Hello\r\nthere "), "Hello\nthere");
  const long = "a".repeat(COMMUNITY_MESSAGE_MAX + 8);
  assert.equal(sanitizeCommunityMessage(long)?.length, COMMUNITY_MESSAGE_MAX);
});

test("previews collapse whitespace and ellipsis in en-AU style", () => {
  assert.equal(communityMessagePreview("  See you\nat  the  foyer  "), "See you at the foyer");
  assert.equal(
    communityMessagePreview("abcdefghijklmnopqrstuvwxyz", 10),
    "abcdefghi…",
  );
});

test("parseCommunityMessage ignores incomplete rows", () => {
  const ok = parseCommunityMessage({
    id: "m1",
    friendship_id: threadA,
    sender_user_id: "user-1",
    body: "Hi",
    created_at: "2026-09-21T01:00:00.000Z",
  });
  assert.equal(ok?.friendshipId, threadA);
  assert.equal(ok?.body, "Hi");
  assert.equal(parseCommunityMessage({ id: "m2", body: "no ids" }), null);
  assert.deepEqual(
    parseCommunityMessages([
      ok,
      { id: "", friendship_id: threadA, sender_user_id: "x", body: "no", created_at: "t" },
    ]).map((row) => row.id),
    ["m1"],
  );
});

test("merge conversations is one thread per accepted friendship, newest first", () => {
  const last = latestMessageByThread([
    {
      id: "old",
      friendshipId: threadA,
      senderUserId: "u1",
      body: "earlier",
      createdAt: "2026-09-21T01:00:00.000Z",
    },
    {
      id: "new",
      friendshipId: threadA,
      senderUserId: "u2",
      body: "later",
      createdAt: "2026-09-21T02:00:00.000Z",
    },
    {
      id: "b",
      friendshipId: threadB,
      senderUserId: "u1",
      body: "other",
      createdAt: "2026-09-21T03:00:00.000Z",
    },
  ]);
  const listed = mergeCommunityConversations(
    [
      {
        ownChildId: "mia",
        ownChildName: "Mia",
        friend: friend({ friendshipId: threadA, name: "Ava", childId: "ava" }),
      },
      {
        ownChildId: "leo",
        ownChildName: "Leo",
        friend: friend({ friendshipId: threadB, name: "Zoe", childId: "zoe" }),
      },
      {
        ownChildId: "dup",
        ownChildName: "Dup",
        friend: friend({ friendshipId: threadA, name: "Ava again", childId: "ava" }),
      },
      {
        ownChildId: "skip",
        ownChildName: "Skip",
        friend: friend({ friendshipId: "not-uuid", name: "Nope" }),
      },
    ],
    last,
  );
  assert.deepEqual(
    listed.map((row) => row.friendshipId),
    [threadB, threadA],
  );
  assert.equal(listed[1]?.lastMessage?.body, "later");
  assert.equal(listed[1]?.ownChildName, "Mia");
});

test("mergeCommunityMessages de-dupes and stays chronological", () => {
  const merged = mergeCommunityMessages(
    [
      {
        id: "m1",
        friendshipId: threadA,
        senderUserId: "u1",
        body: "first",
        createdAt: "2026-09-21T01:00:00.000Z",
      },
    ],
    [
      {
        id: "m1",
        friendshipId: threadA,
        senderUserId: "u1",
        body: "first",
        createdAt: "2026-09-21T01:00:00.000Z",
      },
      {
        id: "m2",
        friendshipId: threadA,
        senderUserId: "u2",
        body: "second",
        createdAt: "2026-09-21T01:01:00.000Z",
      },
    ],
  );
  assert.deepEqual(
    merged.map((row) => row.id),
    ["m1", "m2"],
  );
});

test("community guidelines are short, warm, and shared by both chats", () => {
  const sentences = COMMUNITY_GUIDELINES.split(/(?<=[.!?])\s+/).filter(Boolean);
  assert.ok(sentences.length >= 2 && sentences.length <= 3);
  assert.match(COMMUNITY_GUIDELINES, /parents and dancers/);
  assert.match(COMMUNITY_GUIDELINES, /past and upcoming competitions/);
  assert.match(COMMUNITY_GUIDELINES, /positive/);
  assert.match(COMMUNITY_GUIDELINES, /foul language/);
  assert.match(COMMUNITY_GUIDELINES, /bullying/);
  assert.match(COMMUNITY_GUIDELINES, /another family/);
});

test("guest copy and missing-SQL errors are plain English", () => {
  assert.equal(GUEST_COMMUNITY_TITLE, "Community unlocks when you sign in");
  assert.match(GUEST_COMMUNITY_BODY, /accepted friends/);
  assert.match(GUEST_COMMUNITY_BODY, /no open public chat/);
  assert.match(
    friendlyCommunityError("Could not find the table public.community_messages"),
    /community chat SQL/,
  );
  assert.match(
    friendlyCommunityError("new row violates row-level security policy"),
    /accepted friends/,
  );
});

test("formatCommunityTime uses Adelaide-local time", () => {
  const iso = "2026-09-21T03:15:00.000Z";
  const sameDay = new Date("2026-09-21T06:00:00.000Z");
  const laterDay = new Date("2026-09-22T06:00:00.000Z");
  assert.match(formatCommunityTime(iso, sameDay), /\d/);
  assert.match(formatCommunityTime(iso, laterDay), /Sep/i);
});
