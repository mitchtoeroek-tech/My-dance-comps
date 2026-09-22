import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dancerChatLabel,
  normalizeChatDisplayName,
  parentChatLabel,
  parentSignupName,
  parentStudioChatLines,
  studioChatSenderLabel,
} from "./chat-label";

test("dancer chat name is first name plus surname initial", () => {
  assert.equal(dancerChatLabel("Mitch Test"), "Mitch T");
  assert.equal(dancerChatLabel("  mitch   test "), "mitch T");
  assert.equal(dancerChatLabel("Mitch"), "Mitch");
  assert.equal(dancerChatLabel("Mary Anne Smith"), "Mary S");
  assert.equal(dancerChatLabel("mitch@example.com"), null);
  assert.equal(dancerChatLabel("   "), null);
});

test("parent chat name uses the parent first name and dancer first names", () => {
  assert.equal(
    parentChatLabel("Sarah", ["Evie Toeroek", "Harriet Toeroek"]),
    "Sarah, parent of Evie and Harriet",
  );
  assert.equal(
    parentChatLabel("Sarah Jane", ["Evie Toeroek"]),
    "Sarah, parent of Evie",
  );
  assert.equal(
    parentChatLabel("", ["Harriet Toeroek", "Evie Toeroek"]),
    "Parent, parent of Evie and Harriet",
  );
  assert.equal(
    parentChatLabel("sarah@example.com", ["Evie Toeroek"]),
    "Parent, parent of Evie",
  );
  assert.equal(
    parentChatLabel("Sarah", ["Mia", "Evie Toeroek", "Harriet"]),
    "Sarah, parent of Evie, Harriet and Mia",
  );
  assert.equal(parentChatLabel("Sarah", []), "Sarah");
  assert.equal(parentChatLabel(null, []), "Parent");
});

test("a dancer login never uses the parent-of template", () => {
  assert.equal(
    studioChatSenderLabel({
      role: "dancer",
      displayName: "Mitch Test",
      dancerName: "Mitch Test",
      childNames: ["Evie Toeroek", "Harriet Toeroek"],
    }),
    "Mitch T",
  );
  assert.equal(
    studioChatSenderLabel({
      role: "dancer",
      displayName: "Mitch",
    }),
    "Mitch",
  );
  assert.equal(
    studioChatSenderLabel({
      role: "parent",
      linkedDancer: true,
      displayName: "Mitch Test",
      dancerName: "Mitch Test",
      childNames: ["Mitch Test"],
    }),
    "Mitch T",
  );
  assert.equal(
    studioChatSenderLabel({ role: "dancer" }),
    "Dancer",
  );
  assert.equal(
    studioChatSenderLabel({
      role: "studio",
      studioName: "Mint Studio",
      displayName: "Sarah",
      childNames: ["Evie"],
    }),
    "Mint Studio",
  );
});

test("parent preview is split per studio", () => {
  assert.deepEqual(
    parentStudioChatLines("Sarah", [
      { name: "Evie Toeroek", studio: "Mint" },
      { name: "Harriet Toeroek", studio: " Mint " },
      { name: "Mia Lane", studio: "Ada" },
    ]),
    [
      { studio: "Mint", label: "Sarah, parent of Evie and Harriet" },
      { studio: "Ada", label: "Sarah, parent of Mia" },
    ],
  );
});

test("chat display name refuses an email and keeps a blank", () => {
  assert.equal(normalizeChatDisplayName("  Sarah Jane  "), "Sarah Jane");
  assert.equal(normalizeChatDisplayName("   "), "");
  assert.equal(normalizeChatDisplayName("sarah@example.com"), null);
  assert.equal(normalizeChatDisplayName(`${"A".repeat(90)}`), "A".repeat(80));
});

test("parent sign-up requires a name and stores it for chat", () => {
  assert.deepEqual(parentSignupName("  Sarah  "), { ok: true, name: "Sarah" });
  assert.deepEqual(parentSignupName("Sarah Jane"), {
    ok: true,
    name: "Sarah Jane",
  });
  assert.equal(parentSignupName("   ").ok, false);
  assert.equal(parentSignupName("sarah@example.com").ok, false);
});
