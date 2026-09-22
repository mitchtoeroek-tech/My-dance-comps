import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeChild } from "./storage";
import { familyStateFromDancerSnapshot } from "./family-sync";
import {
  adminAllowlist,
  approvedStudioMark,
  formatStudioAddress,
  friendlyStudioError,
  isAllowlistedAdmin,
  isPublicStudio,
  parseStudioStatus,
  slugifyStudioName,
  fetchApprovedStudioMarks,
  studioLogoPublicUrl,
  validateStudioDraft,
  validateStudioLogo,
} from "./studios";

const STUDIO_ID = "11111111-1111-4111-8111-111111111111";

test("studio names become stable public slugs", () => {
  assert.equal(slugifyStudioName("  Mint Studio "), "mint-studio");
  assert.equal(slugifyStudioName("A & B Dance!"), "a-and-b-dance");
  assert.equal(slugifyStudioName("!!!"), "studio");
});

test("only approved studios are public", () => {
  assert.equal(isPublicStudio("approved"), true);
  assert.equal(isPublicStudio("pending"), false);
  assert.equal(isPublicStudio("rejected"), false);
  assert.equal(parseStudioStatus("nope"), "pending");
});

test("admin allowlist always includes Mitch and extra env addresses", () => {
  assert.deepEqual(adminAllowlist(""), ["mitch@greenefficientliving.com.au"]);
  assert.deepEqual(adminAllowlist("other@example.com, mitch@greenefficientliving.com.au"), [
    "mitch@greenefficientliving.com.au",
    "other@example.com",
  ]);
  assert.equal(
    isAllowlistedAdmin("Mitch@Greenefficientliving.com.au", adminAllowlist("")),
    true,
  );
  assert.equal(isAllowlistedAdmin("parent@example.com", adminAllowlist("")), false);
});

test("studio address uses Australian street, suburb, state and postcode", () => {
  assert.equal(
    formatStudioAddress({
      addressLine: "12 King Street",
      suburb: "Adelaide",
      state: "SA",
      postcode: "5000",
    }),
    "12 King Street, Adelaide SA 5000",
  );
  assert.equal(
    formatStudioAddress({
      addressLine: "",
      suburb: "Norwood",
      state: "SA",
      postcode: "",
    }),
    "Norwood SA",
  );
});

test("studio draft checks name, postcode and website", () => {
  const bad = validateStudioDraft({
    name: "A",
    about: "",
    styles: ["Jazz"],
    addressLine: "",
    suburb: "",
    state: "SA",
    postcode: "50",
    phone: "",
    website: "",
    contactEmail: "",
  });
  assert.equal(bad.ok, false);

  const good = validateStudioDraft({
    name: "Mint Studio",
    about: "Jazz and tap.",
    styles: ["Jazz", "Not a style" as "Jazz"],
    addressLine: "1 Main Road",
    suburb: "Unley",
    state: "SA",
    postcode: "5061",
    phone: "08 1234 5678",
    website: "mintstudio.com.au",
    contactEmail: "hello@mintstudio.com.au",
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.value.website, "https://mintstudio.com.au");
    assert.deepEqual(good.value.styles, ["Jazz"]);
  }
});

test("dancer cards only take a logo from an approved studio", () => {
  const url = "https://example.supabase.co";
  const approved = approvedStudioMark(
    {
      id: STUDIO_ID,
      name: "Mitch Test Studio",
      status: "approved",
      logoPath: `${STUDIO_ID}/logo`,
      updatedAt: "2026-09-22T00:00:00.000Z",
    },
    url,
  );
  assert.equal(approved?.id, STUDIO_ID);
  assert.equal(approved?.name, "Mitch Test Studio");
  assert.equal(
    approved?.logoUrl,
    studioLogoPublicUrl(`${STUDIO_ID}/logo`, "2026-09-22T00:00:00.000Z", url),
  );

  const missingLogo = approvedStudioMark(
    {
      id: STUDIO_ID,
      name: "Mint Studio",
      status: "approved",
      logoPath: "  ",
      updatedAt: null,
    },
    url,
  );
  assert.equal(missingLogo?.name, "Mint Studio");
  assert.equal(missingLogo?.logoUrl, null);

  assert.equal(
    approvedStudioMark(
      {
        id: STUDIO_ID,
        name: "Mint Studio",
        status: "pending",
        logoPath: `${STUDIO_ID}/logo`,
      },
      url,
    ),
    null,
  );
  assert.equal(
    approvedStudioMark(
      {
        id: STUDIO_ID,
        name: "Mint Studio",
        status: "rejected",
        logoPath: `${STUDIO_ID}/logo`,
      },
      url,
    ),
    null,
  );
  assert.equal(
    approvedStudioMark(
      {
        id: "Local hall",
        name: "Local hall",
        status: "approved",
        logoPath: `${STUDIO_ID}/logo`,
      },
      url,
    ),
    null,
  );
});

test("studio mark lookup does nothing until accounts are connected", async () => {
  assert.deepEqual(await fetchApprovedStudioMarks([STUDIO_ID, "Local hall"]), []);
});

test("logo url and file checks", () => {
  assert.equal(
    studioLogoPublicUrl("abc/logo", "2026-01-01", "https://example.supabase.co"),
    "https://example.supabase.co/storage/v1/object/public/studio-logos/abc/logo?v=2026-01-01",
  );
  assert.equal(studioLogoPublicUrl(null, null, "https://example.supabase.co"), null);
  assert.equal(validateStudioLogo({ type: "image/gif", size: 10 }), "Logo needs to be a PNG, JPG or WebP image.");
  assert.equal(validateStudioLogo({ type: "image/png", size: 3 * 1024 * 1024 }), "Logo needs to be 2 MB or smaller.");
  assert.equal(validateStudioLogo({ type: "image/png", size: 100 }), null);
});

test("friendly studio errors point at approval and the SQL file", () => {
  assert.match(friendlyStudioError("That studio is not available to link"), /not public yet/);
  assert.match(friendlyStudioError("Only an admin can change studio approval"), /Only an admin/);
  assert.match(
    friendlyStudioError("Could not find the table public.studios in the schema cache"),
    /20260922_studio_accounts\.sql/,
  );
});

test("dancer profiles keep a linked studio id and ignore a typed-only name", () => {
  const linked = normalizeChild({
    id: "mia",
    name: "Mia",
    studio: "Mint Studio",
    studioId: STUDIO_ID.toUpperCase(),
  });
  assert.equal(linked?.studioId, STUDIO_ID);
  assert.equal(linked?.studio, "Mint Studio");

  const typed = normalizeChild({
    id: "mia",
    name: "Mia",
    studio: "Local hall",
    studioId: "Local hall",
  });
  assert.equal(typed?.studioId, null);
  assert.equal(typed?.studio, "Local hall");
});

test("dancer cloud snapshot keeps the linked studio id", () => {
  const parsed = familyStateFromDancerSnapshot({
    linked: true,
    child: {
      id: "mia",
      name: "Mia",
      dob: "2018-06-15",
      styles: ["Jazz"],
      studio: "Mint Studio",
      studio_id: STUDIO_ID,
      home_state: "SA",
    },
    enrolled_owned: false,
    enrolled_ids: [],
    results: [],
  });
  assert.equal(parsed.state?.children[0]?.studioId, STUDIO_ID);
  assert.equal(parsed.state?.children[0]?.studio, "Mint Studio");
});
