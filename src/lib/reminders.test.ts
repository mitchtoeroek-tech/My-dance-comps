import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  isReminderEmailConfigured,
  sendReminderDigest,
} from "./reminder-email";
import {
  absorbCompCatalogue,
  emptyReminderWatch,
} from "./reminder-watch";
import {
  buildReminders,
  dancersWithoutStyles,
  dueReminders,
  familyMatchesComp,
  inAppReminders,
  remindersForComp,
  type ReminderScope,
} from "./reminders";
import { defaultReminderPrefs } from "./storage";
import type {
  ChildProfile,
  Competition,
  ReminderItem,
  ReminderPrefs,
} from "./types";

const now = new Date("2026-09-22T02:00:00.000Z");
const later = new Date("2026-09-23T02:00:00.000Z");

function comp(partial: Partial<Competition> & Pick<Competition, "id">): Competition {
  return {
    name: partial.name ?? partial.id,
    kind: "competition",
    organiser: "Org",
    organiserUrl: "",
    venue: "Hall",
    suburb: "Adelaide",
    state: "SA",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    registrationOpens: null,
    registrationCloses: null,
    registrationUrl: "",
    infoUrl: "",
    styles: ["Jazz"],
    minAge: null,
    maxAge: null,
    isNational: false,
    notes: "",
    sourceId: "test",
    lastUpdated: "2026-09-22",
    ...partial,
  };
}

function dancer(partial: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: "mia",
    name: "Mia",
    dob: "2014-06-15",
    styles: ["Jazz", "Contemporary"],
    studio: "",
    homeState: "SA",
    ...partial,
  };
}

const prefsOn: ReminderPrefs = {
  newlyAnnounced: true,
  onOpen: true,
  emailEnabled: false,
};

function scope(partial: Partial<ReminderScope> = {}): ReminderScope {
  return {
    children: [dancer()],
    includeInterstate: false,
    baselinedAt: now.toISOString(),
    announcedAt: {},
    openedAt: {},
    ...partial,
  };
}

test("a Jazz and Contemporary dancer does not match a Ballet-only comp", () => {
  const ballet = comp({
    id: "ballet",
    name: "Ballet Only",
    styles: ["Ballet"],
  });
  assert.equal(familyMatchesComp(ballet, [dancer()], false), false);
  assert.equal(
    remindersForComp(ballet, prefsOn, scope({ announcedAt: { ballet: later.toISOString() } }), later)
      .length,
    0,
  );
});

test("a matching style in the home state is included, including mixed-style comps", () => {
  const jazz = comp({ id: "jazz", styles: ["Jazz", "Ballet"] });
  assert.equal(familyMatchesComp(jazz, [dancer()], false), true);
});

test("interstate comps stay out unless the family has included them; nationals still match", () => {
  const vic = comp({ id: "vic", state: "VIC", styles: ["Jazz"] });
  const national = comp({
    id: "nat",
    state: "NSW",
    styles: ["Contemporary"],
    isNational: true,
  });
  const children = [dancer()];
  assert.equal(familyMatchesComp(vic, children, false), false);
  assert.equal(familyMatchesComp(vic, children, true), true);
  assert.equal(familyMatchesComp(national, children, false), true);
});

test("a dancer with no styles matches every style", () => {
  const ballet = comp({ id: "ballet", styles: ["Ballet"] });
  const open = dancer({ id: "leo", name: "Leo", styles: [] });
  assert.equal(familyMatchesComp(ballet, [open], false), true);
  assert.deepEqual(
    dancersWithoutStyles([dancer(), open]).map((child) => child.name),
    ["Leo"],
  );
});

test("no dancers means no reminders, even for a newly announced comp", () => {
  const jazz = comp({ id: "jazz" });
  assert.equal(familyMatchesComp(jazz, [], true), false);
  assert.equal(
    buildReminders(
      [jazz],
      prefsOn,
      scope({ children: [], announcedAt: { jazz: later.toISOString() } }),
      later,
    ).length,
    0,
  );
});

test("any matching dancer counts, not a single selected child and not favourites", () => {
  const ballet = comp({ id: "ballet", styles: ["Ballet"] });
  const children = [
    dancer(),
    dancer({ id: "ava", name: "Ava", styles: ["Ballet"] }),
  ];
  assert.equal(familyMatchesComp(ballet, children, false), true);
  const items = buildReminders(
    [ballet],
    prefsOn,
    scope({
      children,
      announcedAt: { ballet: later.toISOString() },
    }),
    later,
  );
  assert.equal(items.length, 1);
  assert.match(items[0]?.detail ?? "", /Ava/);
  assert.doesNotMatch(items[0]?.detail ?? "", /Mia/);
});

test("the first catalogue is a watermark and only later comps are newly announced", () => {
  const jazz = comp({ id: "jazz" });
  const ballet = comp({ id: "ballet", styles: ["Ballet"] });
  const first = absorbCompCatalogue(emptyReminderWatch(), [jazz, ballet], now, "live");
  assert.equal(first.provisional, false);
  assert.deepEqual(first.announcedAt, {});

  const extra = comp({ id: "new-jazz", name: "City Jazz", styles: ["Jazz"] });
  const second = absorbCompCatalogue(
    first,
    [jazz, ballet, extra],
    later,
    "live",
  );
  assert.equal(second.announcedAt["new-jazz"], later.toISOString());
  assert.equal(second.announcedAt.jazz, undefined);

  const items = buildReminders(
    [jazz, ballet, extra],
    prefsOn,
    scope({
      baselinedAt: second.baselinedAt,
      announcedAt: second.announcedAt,
    }),
    later,
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ["new-jazz:newly-announced"],
  );
});

test("a provisional seed baseline does not announce comps already in the live list", () => {
  const jazz = comp({ id: "jazz" });
  const seed = absorbCompCatalogue(emptyReminderWatch(), [jazz], now, "seed");
  assert.equal(seed.provisional, true);
  const extra = comp({ id: "live-jazz", styles: ["Jazz"] });
  const live = absorbCompCatalogue(seed, [jazz, extra], later, "live");
  assert.equal(live.provisional, false);
  assert.deepEqual(live.announcedAt, {});
  assert.ok(live.seenIds.includes("live-jazz"));
});

test("entries open once from a future open date, and not for a date already past at baseline", () => {
  const upcoming = comp({
    id: "soon",
    registrationOpens: "2026-10-01T09:00:00",
  });
  const already = comp({
    id: "past",
    registrationOpens: "2026-08-01T09:00:00",
  });
  const items = buildReminders(
    [upcoming, already],
    { ...prefsOn, newlyAnnounced: false },
    scope(),
    now,
  );
  assert.deepEqual(
    items.map((item) => item.compId),
    ["soon"],
  );
  assert.equal(items[0]?.kind, "open");
});

test("registration becoming open without an open date reminds once", () => {
  const quiet = comp({ id: "tbc", styles: ["Jazz"] });
  const watched = absorbCompCatalogue(emptyReminderWatch(), [quiet], now, "live");
  assert.equal(watched.openedAt.tbc, undefined);
  const opened = comp({
    id: "tbc",
    styles: ["Jazz"],
    registrationCloses: "2026-12-01T17:00:00",
  });
  const next = absorbCompCatalogue(watched, [opened], later, "live");
  assert.equal(next.openedAt.tbc, later.toISOString());
  const again = absorbCompCatalogue(next, [opened], new Date("2026-09-24T02:00:00.000Z"), "live");
  assert.equal(again.openedAt.tbc, later.toISOString());

  const items = buildReminders(
    [opened],
    { ...prefsOn, newlyAnnounced: false },
    scope({ baselinedAt: next.baselinedAt, openedAt: next.openedAt }),
    later,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, "tbc:open");
});

test("a comp already open at baseline does not get an open transition", () => {
  const already = comp({
    id: "open-now",
    registrationCloses: "2026-12-01T17:00:00",
  });
  const watched = absorbCompCatalogue(emptyReminderWatch(), [already], now, "live");
  assert.equal(watched.openedAt["open-now"], undefined);
});

test("notified ids are not due again", () => {
  const item: ReminderItem = {
    id: "jazz:newly-announced",
    kind: "newly-announced",
    compId: "jazz",
    compName: "Jazz",
    fireAt: now.toISOString(),
    label: "New comp — Jazz",
    detail: "For Mia.",
  };
  assert.equal(dueReminders([item], [], now).length, 1);
  assert.equal(dueReminders([item], ["jazz:newly-announced"], now).length, 0);
});

test("in-app list keeps recent announcements and drops stale ones", () => {
  const recent: ReminderItem = {
    id: "a:newly-announced",
    kind: "newly-announced",
    compId: "a",
    compName: "A",
    fireAt: new Date("2026-09-20T02:00:00.000Z").toISOString(),
    label: "New",
    detail: "",
  };
  const stale: ReminderItem = {
    id: "b:newly-announced",
    kind: "newly-announced",
    compId: "b",
    compName: "B",
    fireAt: new Date("2026-07-01T02:00:00.000Z").toISOString(),
    label: "Old",
    detail: "",
  };
  const ids = inAppReminders([recent, stale], now).map((item) => item.id);
  assert.deepEqual(ids, ["a:newly-announced"]);
});

test("turning both reminder types off produces no items", () => {
  const items = buildReminders(
    [comp({ id: "jazz", registrationOpens: "2026-10-01T09:00:00" })],
    { newlyAnnounced: false, onOpen: false, emailEnabled: true },
    scope({ announcedAt: { jazz: later.toISOString() } }),
    later,
  );
  assert.equal(items.length, 0);
});

test("default prefs turn both reminder types on and email off", () => {
  assert.equal(defaultReminderPrefs.newlyAnnounced, true);
  assert.equal(defaultReminderPrefs.onOpen, true);
  assert.equal(defaultReminderPrefs.emailEnabled, false);
});

const prevKey = process.env.RESEND_API_KEY;
const prevFrom = process.env.REMINDER_EMAIL_FROM;

afterEach(() => {
  if (prevKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = prevKey;
  if (prevFrom === undefined) delete process.env.REMINDER_EMAIL_FROM;
  else process.env.REMINDER_EMAIL_FROM = prevFrom;
});

test("email is not sent when Resend is not configured", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.REMINDER_EMAIL_FROM;
  assert.equal(isReminderEmailConfigured(), false);
  let called = false;
  const result = await sendReminderDigest({
    to: "parent@example.com",
    items: [
      {
        id: "jazz:open",
        kind: "open",
        compId: "jazz",
        compName: "Jazz",
        fireAt: now.toISOString(),
        label: "Entries open — Jazz",
        detail: "For Mia.",
      },
    ],
    fetchImpl: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, {
    configured: false,
    sent: false,
    reason: "not_configured",
  });
});

test("configured email uses the provider and reports failure honestly", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.REMINDER_EMAIL_FROM = "My Dance Comps <reminders@example.com>";
  const failed = await sendReminderDigest({
    to: "parent@example.com",
    items: [
      {
        id: "jazz:open",
        kind: "open",
        compId: "jazz",
        compName: "Jazz",
        fireAt: now.toISOString(),
        label: "Entries open — Jazz",
        detail: "For Mia.",
      },
    ],
    fetchImpl: async () => new Response("no", { status: 401 }),
  });
  assert.equal(failed.configured, true);
  assert.equal(failed.sent, false);
  if (!failed.sent) assert.equal(failed.reason, "provider_error");

  const sent = await sendReminderDigest({
    to: "parent@example.com",
    items: [
      {
        id: "jazz:open",
        kind: "open",
        compId: "jazz",
        compName: "Jazz",
        fireAt: now.toISOString(),
        label: "Entries open — Jazz",
        detail: "For Mia.",
      },
    ],
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  assert.deepEqual(sent, { configured: true, sent: true });
});
