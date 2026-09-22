import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_NAV_BADGE_SCOPE,
  communityHasUnread,
  latestActivityAt,
  mergeSeenIds,
  navBadgeOwnerId,
  parseNavBadgeStore,
  remindersHaveUnread,
  withCommunitySeen,
  withRemindersSeen,
} from "./nav-badges";

const older = "2026-09-20T01:00:00.000Z";
const newer = "2026-09-22T03:30:00+00:00";
const now = "2026-09-22T04:00:00.000Z";

test("latest activity ignores invalid stamps and mixed offsets", () => {
  assert.equal(latestActivityAt([null, "", "not-a-date"]), null);
  assert.equal(latestActivityAt([older, newer, "nope"]), newer);
  assert.equal(
    latestActivityAt(["2026-09-22T04:00:00+00:00", "2026-09-22T04:00:00.000Z"]),
    "2026-09-22T04:00:00+00:00",
  );
});

test("community dot is only for a message after the watermark", () => {
  assert.equal(communityHasUnread(newer, EMPTY_NAV_BADGE_SCOPE), false);

  const baselined = withCommunitySeen(EMPTY_NAV_BADGE_SCOPE, older, now);
  assert.equal(baselined.communityBaselined, true);
  assert.equal(baselined.lastSeenCommunityAt, now);
  assert.equal(communityHasUnread(older, baselined), false);
  assert.equal(communityHasUnread(now, baselined), false);
  assert.equal(
    communityHasUnread("2026-09-22T04:00:01.000Z", baselined),
    true,
  );

  const caughtUp = withCommunitySeen(
    baselined,
    "2026-09-22T04:00:01.000Z",
    "2026-09-22T04:00:01.000Z",
  );
  assert.equal(communityHasUnread("2026-09-22T04:00:01.000Z", caughtUp), false);
  assert.equal(
    withCommunitySeen(caughtUp, older, older),
    caughtUp,
  );
});

test("reminder dot is only for an id that is not in the seen set", () => {
  assert.equal(remindersHaveUnread(["comp:open"], EMPTY_NAV_BADGE_SCOPE), false);

  const baselined = withRemindersSeen(EMPTY_NAV_BADGE_SCOPE, [
    "comp:open",
    "comp:newly-announced",
  ]);
  assert.equal(baselined.remindersBaselined, true);
  assert.equal(remindersHaveUnread(["comp:open"], baselined), false);
  assert.equal(remindersHaveUnread(["other:open"], baselined), true);

  const seen = withRemindersSeen(baselined, ["comp:open", "other:open"]);
  assert.equal(remindersHaveUnread(["other:open"], seen), false);
  assert.equal(withRemindersSeen(seen, ["other:open"]), seen);
});

test("seen reminder ids keep the newest ids when the cap is hit", () => {
  const previous = Array.from({ length: 400 }, (_, index) => `old-${index}`);
  const merged = mergeSeenIds(previous, ["new-id"]);
  assert.equal(merged[0], "new-id");
  assert.equal(merged.length, 400);
  assert.equal(merged.includes("old-399"), false);
  assert.equal(merged.includes("old-0"), true);
});

test("stored watermarks ignore junk and invalid owners", () => {
  assert.equal(navBadgeOwnerId(null), "guest");
  assert.equal(navBadgeOwnerId("  "), "guest");
  assert.equal(
    navBadgeOwnerId("123e4567-e89b-12d3-a456-426614174000"),
    "123e4567-e89b-12d3-a456-426614174000",
  );

  const parsed = parseNavBadgeStore({
    version: 1,
    owners: {
      guest: {
        communityBaselined: true,
        lastSeenCommunityAt: "yesterday",
        remindersBaselined: true,
        seenReminderIds: ["comp:open", 4, "comp:open", "  "],
      },
      "not an id": { remindersBaselined: true },
    },
  });
  assert.equal(parsed.guest.communityBaselined, false);
  assert.equal(parsed.guest.lastSeenCommunityAt, null);
  assert.deepEqual(parsed.guest.seenReminderIds, ["comp:open"]);
  assert.equal(parsed["not an id"], undefined);
  assert.deepEqual(parseNavBadgeStore({ version: 2, owners: {} }), {});
});
