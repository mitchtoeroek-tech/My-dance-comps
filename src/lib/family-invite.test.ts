import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coparentInviteUrl,
  coparentJoinPath,
  coparentSignupPath,
  dancerInvitePath,
  dancerInviteUrl,
  familyJoinPath,
  pickUnlinkedInviteChild,
  readCoparentInvite,
  readDancerInvite,
} from "./family-invite";

test("dancer invite link prefills signup for one profile", () => {
  assert.equal(
    dancerInvitePath("ab12-cd34", "child-1"),
    "/signup?role=dancer&family=AB12CD34&child=child-1",
  );
  assert.equal(
    dancerInviteUrl("https://my-dance-comps.vercel.app/", "ab12cd34", "child-1"),
    "https://my-dance-comps.vercel.app/signup?role=dancer&family=AB12CD34&child=child-1",
  );
});

test("family join path keeps the family code and child id", () => {
  assert.equal(
    familyJoinPath("ab12-cd34", "mia"),
    "/family/join?family=AB12CD34&child=mia",
  );
  assert.equal(familyJoinPath("ab12cd34", "  "), "/family/join?family=AB12CD34");
});

test("readDancerInvite reads the signup link and a login next path", () => {
  assert.deepEqual(
    readDancerInvite("?role=dancer&family=ab12-cd34&child=mia"),
    { family: "AB12CD34", childId: "mia", role: "dancer" },
  );
  const next = encodeURIComponent("/family/join?family=AB12CD34&child=mia");
  assert.deepEqual(readDancerInvite(`next=${next}`), {
    family: "AB12CD34",
    childId: "mia",
    role: "dancer",
  });
  assert.equal(readDancerInvite(""), null);
  assert.equal(readDancerInvite("?role=parent"), null);
  assert.equal(readDancerInvite("?next=https://evil.example/family/join"), null);
  assert.equal(readDancerInvite("?next=//family/join?family=AB12CD34"), null);
});

test("co-parent invite is a parent signup link, separate from the dancer code", () => {
  assert.equal(
    coparentSignupPath("ab12-cd34"),
    "/signup?role=parent&coparent=AB12CD34",
  );
  assert.equal(
    coparentJoinPath("ab12cd34"),
    "/family/join?coparent=AB12CD34",
  );
  assert.equal(
    coparentInviteUrl("https://my-dance-comps.vercel.app/", "ab12cd34"),
    "https://my-dance-comps.vercel.app/signup?role=parent&coparent=AB12CD34",
  );
  assert.deepEqual(readCoparentInvite("?role=parent&coparent=ab12-cd34"), {
    code: "AB12CD34",
  });
  const next = encodeURIComponent("/family/join?coparent=AB12CD34");
  assert.deepEqual(readCoparentInvite(`next=${next}`), { code: "AB12CD34" });
  assert.equal(readCoparentInvite("?role=dancer&family=AB12CD34"), null);
  assert.equal(readCoparentInvite(""), null);
  assert.equal(readDancerInvite("?role=parent&coparent=AB12CD34"), null);
});

test("pickUnlinkedInviteChild only selects a free named profile", () => {
  const dancers = [
    { id: "mia", linked: false },
    { id: "ava", linked: true },
  ];
  assert.equal(pickUnlinkedInviteChild(dancers, "mia"), "mia");
  assert.equal(pickUnlinkedInviteChild(dancers, "ava"), null);
  assert.equal(pickUnlinkedInviteChild(dancers, "nope"), null);
  assert.equal(pickUnlinkedInviteChild(dancers, " "), null);
});
