import assert from "node:assert/strict";
import { test } from "node:test";
import {
  friendlyStudioCommunityError,
  mergeStudioCommunityMessages,
  parseStudioChat,
  parseStudioChats,
  parseStudioCommunityMessage,
  safeStudioSenderLabel,
  sanitizeStudioCommunityMessage,
  STUDIO_CHAT_EMPTY_BODY,
  STUDIO_COMMUNITY_MESSAGE_MAX,
  studioChatListPreview,
  studioCommunityThreadPath,
} from "./studio-community";

const studioA = "11111111-1111-4111-8111-111111111111";
const studioB = "22222222-2222-4222-8222-222222222222";

test("studio chat paths use the studio id", () => {
  assert.equal(
    studioCommunityThreadPath(studioA.toUpperCase()),
    `/community/studio/${studioA}`,
  );
  assert.equal(studioCommunityThreadPath("not-a-studio"), "/community/studio/not-a-studio");
});

test("studio messages use the same trim and length cap as friend chat", () => {
  assert.equal(sanitizeStudioCommunityMessage("   "), null);
  assert.equal(sanitizeStudioCommunityMessage(" Hello\r\nthere "), "Hello\nthere");
  const long = "a".repeat(STUDIO_COMMUNITY_MESSAGE_MAX + 4);
  assert.equal(sanitizeStudioCommunityMessage(long)?.length, STUDIO_COMMUNITY_MESSAGE_MAX);
});

test("sender labels never keep an email", () => {
  assert.equal(safeStudioSenderLabel("Parent of Mia"), "Parent of Mia");
  assert.equal(safeStudioSenderLabel("  Mint   Studio  "), "Mint Studio");
  assert.equal(safeStudioSenderLabel("parent@example.com"), "Member");
  assert.equal(safeStudioSenderLabel(""), "Member");
  assert.equal(safeStudioSenderLabel(null), "Member");
});

test("parseStudioCommunityMessage drops incomplete rows and hides emails", () => {
  const ok = parseStudioCommunityMessage({
    id: "m1",
    studio_id: studioA.toUpperCase(),
    sender_user_id: "user-1",
    sender_label: "mia@studio.test",
    body: "See you in the foyer",
    created_at: "2026-09-22T01:00:00.000Z",
  });
  assert.equal(ok?.studioId, studioA);
  assert.equal(ok?.senderLabel, "Member");
  assert.equal(ok?.body, "See you in the foyer");
  assert.equal(parseStudioCommunityMessage({ id: "m2", body: "no" }), null);
});

test("one studio chat per studio, newest message first", () => {
  const listed = parseStudioChats([
    {
      studio_id: studioA,
      name: "Mitch Test Studio",
      slug: "mitch-test-studio",
      logo_path: "11111111-1111-4111-8111-111111111111/logo",
      updated_at: "2026-09-22T00:00:00.000Z",
      last_body: "Earlier",
      last_sender_label: "Parent of Mia",
      last_created_at: "2026-09-22T01:00:00.000Z",
    },
    {
      studio_id: studioA,
      name: "Mitch Test Studio",
      slug: "mitch-test-studio",
      last_body: "Later",
      last_sender_label: "parent@example.com",
      last_created_at: "2026-09-22T03:00:00.000Z",
    },
    {
      studio_id: studioB,
      name: "Ada Studio",
      slug: "ada-studio",
      last_body: "",
      last_created_at: "",
    },
    { name: "Missing id" },
  ]);
  assert.deepEqual(
    listed.map((row) => row.studioId),
    [studioA, studioB],
  );
  assert.equal(listed[0]?.lastBody, "Later");
  assert.equal(listed[0]?.lastSenderLabel, "Member");
  assert.equal(listed[0]?.logoPath, `${studioA}/logo`);
  assert.equal(
    studioChatListPreview(listed[0]!),
    "Member: Later",
  );
  assert.equal(studioChatListPreview(listed[1]!), "No messages yet — say hello.");
});

test("parseStudioChat ignores a blank name", () => {
  assert.equal(parseStudioChat({ studio_id: studioA, name: "  " }), null);
});

test("mergeStudioCommunityMessages de-dupes and stays chronological", () => {
  const merged = mergeStudioCommunityMessages(
    [
      {
        id: "m1",
        studioId: studioA,
        senderUserId: "u1",
        senderLabel: "Parent of Mia",
        body: "first",
        createdAt: "2026-09-22T01:00:00.000Z",
      },
    ],
    [
      {
        id: "m1",
        studioId: studioA,
        senderUserId: "u1",
        senderLabel: "Parent of Mia",
        body: "first",
        createdAt: "2026-09-22T01:00:00.000Z",
      },
      {
        id: "m2",
        studioId: studioA,
        senderUserId: "u2",
        senderLabel: "Leo",
        body: "second",
        createdAt: "2026-09-22T01:01:00.000Z",
      },
    ],
  );
  assert.deepEqual(
    merged.map((row) => row.id),
    ["m1", "m2"],
  );
});

test("missing studio chat SQL is explained without blaming friend chat", () => {
  assert.match(STUDIO_CHAT_EMPTY_BODY, /approved studio/);
  assert.match(
    friendlyStudioCommunityError(
      "Could not find the function public.list_my_studio_chats",
    ),
    /studio chat SQL/,
  );
  assert.match(
    friendlyStudioCommunityError("new row violates row-level security policy"),
    /approved studio/,
  );
  assert.doesNotMatch(
    friendlyStudioCommunityError("new row violates row-level security policy"),
    /accepted friends/,
  );
});
