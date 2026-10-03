import assert from "node:assert/strict";
import { test } from "node:test";
import {
  organiserInitials,
  organiserMark,
} from "./organiser-logo";

test("known organisers resolve to a stored logo", () => {
  assert.equal(
    organiserMark({ sourceId: "full-out", organiser: "Full Out" })?.kind,
    "image",
  );
  assert.equal(
    organiserMark({ sourceId: "sasds", organiser: "South Australian State Dance Sport" })
      && (organiserMark({
        sourceId: "sasds",
        organiser: "South Australian State Dance Sport",
      }) as { src: string }).src,
    "/organisers/sasds.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "cmidc", organiser: "Count Me In Dance Competition" }) as { src: string }).src,
    "/organisers/cmidc.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "evolution", organiser: "Evolution Dance Comp" }) as { src: string }).src,
    "/organisers/evolution.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "carnival", organiser: "Carnival Dance Challenge" }) as { src: string }).src,
    "/organisers/carnival.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "jump", organiser: "Jump Dance Challenge" }) as { src: string }).src,
    "/organisers/jump.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "showcase", organiser: "Showcase" }) as { src: string }).src,
    "/organisers/showcase.png",
  );
  assert.equal(
    (organiserMark({ sourceId: "supreme", organiser: "Supreme Dance Experience" }) as { src: string }).src,
    "/organisers/supreme.png",
  );
});

test("aggregator rows use the listed organiser, not Dance Hub", () => {
  const evolution = organiserMark({
    sourceId: "dance-hub-qld",
    organiser: "Evolution Dance Competition",
  });
  assert.equal(evolution?.kind, "image");
  assert.equal((evolution as { src: string }).src, "/organisers/evolution.png");

  const carnival = organiserMark({
    sourceId: "dance-hub-nsw",
    organiser: "Carnival Dance Challenge",
  });
  assert.equal((carnival as { src: string }).src, "/organisers/carnival.png");

  const shine = organiserMark({
    sourceId: "dance-hub-qld",
    organiser: "Time to Shine",
  });
  assert.equal(shine?.kind, "image");
  assert.equal((shine as { src: string }).src, "/organisers/time-to-shine.png");

  const hollywood = organiserMark({
    sourceId: "dance-hub-nsw",
    organiser: "Hollywood Bound",
  });
  assert.deepEqual(
    hollywood && {
      kind: hollywood.kind,
      initials: hollywood.kind === "monogram" ? hollywood.initials : "",
    },
    { kind: "monogram", initials: "HB" },
  );
});

test("monograms ignore subtitles and filler words", () => {
  assert.equal(organiserInitials("Adrenaline Dance Comp – solos"), "ADC");
  assert.equal(organiserInitials("Everybody Sing and Dance Now – troupes"), "ESD");
  assert.equal(organiserInitials("Get the Beat"), "GB");
  assert.equal(organiserInitials("Follow Your Dreams"), "FYD");
  assert.equal(organiserInitials("Dance Competitions SA"), "DCS");
  assert.equal(organiserInitials("Live to Dance"), "LTD");
});

test("missing organiser and source omits the mark", () => {
  assert.equal(organiserMark({ sourceId: "", organiser: "" }), null);
  assert.equal(
    organiserMark({ sourceId: "dance-hub-nsw", organiser: "See source" }),
    null,
  );
});
