import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBlockedChallengeHtml,
  mergeComps,
  parseAussieDateRange,
  parseFullOutHtml,
  reconcileLiveWithSeeds,
} from "./scrape";
import type { CompSource, Competition } from "./types";

const source: CompSource = {
  id: "full-out",
  name: "Full Out",
  url: "https://fullout.com.au",
  scrapeUrl: "https://fullout.com.au/enter/",
  parser: "full-out",
  notes: "Australian Full Out",
  region: "National",
};

const fixture = `<!doctype html><html><body>
<div class="et_pb_text et_pb_text_1 et_clickable">
  <div class="et_pb_text_inner">
    <h2>STATE FINALS</h2>
    <p>December 16-18 Futures Events Centre Reynella ENTRIES OPEN</p>
  </div>
</div>
<div class="et_pb_text et_pb_text_4 et_clickable">
  <div class="et_pb_text_inner">
    <h2>Melbourne</h2>
    <h2>SOLOS/DUOS</h2>
    <p>Oct 31-Nov 1 Gladstone Park Secondary College ENTRIES OPEN</p>
  </div>
</div>
<div class="et_pb_text et_pb_text_10">
  <div class="et_pb_text_inner">
    <h2>Darwin</h2>
    <h2>TROUPES</h2>
    <p>August 22-23 Charles Darwin University SOLD OUT</p>
  </div>
</div>
<div class="et_pb_text et_pb_text_11">
  <div class="et_pb_text_inner">
    <h2>Adelaide 1</h2>
    <p>Feb 20-22 Golden Grove Arts Centre SOLD OUT</p>
  </div>
</div>
<div class="et_pb_text et_pb_text_12 et_clickable">
  <div class="et_pb_text_inner">
    <h2>STATE FINALS</h2>
    <p>December 16-18 Futures Events Centre Reynella ENTRIES OPEN</p>
  </div>
</div>
<p>2026 Please email all waitlist requests to dance@fullout.com.au</p>
<script>
var et_link_options_data = [
  {"class":"et_pb_text_1","url":"https://fulloutstatefinals.mycomphq.com.au","target":"_blank"},
  {"class":"et_pb_text_4","url":"https://fulloutmelbourne.mycomphq.com.au/performers","target":"_blank"},
  {"class":"et_pb_text_12","url":"https://fulloutstatefinals.mycomphq.com.au","target":"_blank"}
];
</script>
</body></html>`;

describe("parseAussieDateRange month-first Full Out cards", () => {
  it("parses Feb 20-22 and Oct 31-Nov 1", () => {
    assert.deepEqual(parseAussieDateRange("Feb 20-22", 2026), {
      startDate: "2026-02-20",
      endDate: "2026-02-22",
    });
    assert.deepEqual(parseAussieDateRange("Oct 31-Nov 1", 2026), {
      startDate: "2026-10-31",
      endDate: "2026-11-01",
    });
    assert.deepEqual(parseAussieDateRange("December 16-18", 2026), {
      startDate: "2026-12-16",
      endDate: "2026-12-18",
    });
  });
});

describe("parseFullOutHtml", () => {
  it("reads AU events, CompHQ links, and states from fullout.com.au cards", () => {
    const rows = parseFullOutHtml(fixture, source, new Date("2026-09-21T09:00:00Z"));
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

    assert.equal(rows.length, 4);
    assert.ok(byId["full-out-state-finals-2026"]);
    assert.equal(byId["full-out-state-finals-2026"].state, "SA");
    assert.equal(byId["full-out-state-finals-2026"].suburb, "Reynella");
    assert.equal(
      byId["full-out-state-finals-2026"].registrationUrl,
      "https://fulloutstatefinals.mycomphq.com.au",
    );
    assert.equal(byId["full-out-melbourne-solos-duos-2026"].state, "VIC");
    assert.equal(
      byId["full-out-melbourne-solos-duos-2026"].registrationUrl,
      "https://fulloutmelbourne.mycomphq.com.au/performers",
    );
    assert.equal(byId["full-out-darwin-troupes-2026"].state, "NT");
    assert.equal(byId["full-out-adelaide-1-2026"].startDate, "2026-02-20");
    assert.equal(byId["full-out-adelaide-1-2026"].endDate, "2026-02-22");
    assert.ok(byId["full-out-state-finals-2026"].lastFetchedAt);

    for (const row of rows) {
      assert.equal(row.organiser, "Full Out");
      assert.equal(row.organiserUrl, "https://fullout.com.au");
      assert.equal(row.infoUrl, "https://fullout.com.au/enter/");
      assert.ok(!JSON.stringify(row).includes("fulloutdanceproduction.com"));
      assert.ok(!row.organiserUrl.includes("fulloutdanceproduction"));
    }
  });

  it("splits Divi headings so glued 'Adelaide 1Feb' cards still parse as 2026", () => {
    const glued = `<!doctype html><html><body>
<div class="et_pb_text et_pb_text_1">
  <div class="et_pb_text_inner"><h2>2026</h2><p>Please email all waitlist requests to dance@fullout.com.au</p></div>
</div>
<div class="et_pb_text et_pb_text_2">
  <div class="et_pb_text_inner"><h2>Adelaide 1</h2><p><strong>Feb 20-22</strong></p><p>Golden Grove Arts Centre</p><p>SOLD OUT</p></div>
</div>
<div class="et_pb_text et_pb_text_3">
  <div class="et_pb_text_inner"><h2>STATE </h2><h2>FINALS</h2><p>December 16-18</p><p>Futures Events Centre Reynella</p><p>ENTRIES OPEN</p></div>
</div>
</body></html>`;
    const rows = parseFullOutHtml(glued, source, new Date("2026-09-21T09:00:00Z"));
    const ids = rows.map((row) => row.id).sort();
    assert.deepEqual(ids, ["full-out-adelaide-1-2026", "full-out-state-finals-2026"]);
    assert.equal(rows.find((row) => row.id.includes("adelaide"))?.startDate, "2026-02-20");
  });
});

function makeComp(
  partial: Partial<Competition> & Pick<Competition, "id" | "name" | "sourceId" | "startDate">,
): Competition {
  return {
    kind: "competition",
    organiser: "Org",
    organiserUrl: "https://example.com",
    venue: "Venue",
    suburb: "Suburb",
    state: "SA",
    endDate: partial.endDate ?? partial.startDate,
    registrationOpens: null,
    registrationCloses: null,
    registrationUrl: "https://example.com",
    infoUrl: "https://example.com",
    styles: ["Jazz"],
    minAge: 5,
    maxAge: 18,
    isNational: false,
    notes: "",
    lastUpdated: "2026-09-21",
    ...partial,
  };
}

describe("mergeComps and reconcileLiveWithSeeds", () => {
  const fullOut = makeComp({
    id: "full-out-state-finals-2026",
    name: "Full Out — State Finals",
    organiser: "Full Out",
    sourceId: "full-out",
    startDate: "2026-12-16",
    endDate: "2026-12-18",
    state: "SA",
    suburb: "Reynella",
  });
  const other = makeComp({
    id: "sasds-eisteddfod-2026",
    name: "SASDS Eisteddfod 2026",
    sourceId: "sasds",
    startDate: "2026-08-01",
  });
  const fullOutSource: CompSource = {
    id: "full-out",
    name: "Full Out",
    url: "https://fullout.com.au",
    scrapeUrl: "https://fullout.com.au/enter/",
    parser: "full-out",
    notes: "",
    region: "National",
  };
  const sasdsSource: CompSource = {
    id: "sasds",
    name: "South Australian State Dance Sport (SASDS)",
    url: "https://www.sasds.com.au",
    scrapeUrl: "https://www.sasds.com.au/information",
    parser: "sasds",
    notes: "",
    region: "SA",
  };

  it("keeps Full Out seeds when a live scrape omits that source", () => {
    const merged = mergeComps([fullOut, other], [other]);
    assert.equal(merged.added, 0);
    assert.ok(merged.comps.some((row) => row.id === "full-out-state-finals-2026"));
    assert.equal(merged.comps.length, 2);
  });

  it("copies CompHQ registration URLs and lastFetchedAt onto existing Full Out seeds", () => {
    const scraped = makeComp({
      ...fullOut,
      registrationUrl: "https://fulloutstatefinals.mycomphq.com.au",
      lastFetchedAt: "2026-09-21T10:00:00.000Z",
    });
    const merged = mergeComps([fullOut], [scraped]);
    const row = merged.comps.find((item) => item.id === fullOut.id);
    assert.equal(merged.updated, 1);
    assert.equal(row?.registrationUrl, "https://fulloutstatefinals.mycomphq.com.au");
    assert.equal(row?.lastFetchedAt, "2026-09-21T10:00:00.000Z");
  });

  it("pads scrape status so Full Out still appears after a stale 49-comp cache", () => {
    const live = {
      comps: [other],
      status: {
        lastRunAt: "2026-09-21T07:21:57.761Z",
        lastFetchedAt: "2026-09-21T07:21:57.761Z",
        timezone: "Australia/Adelaide" as const,
        added: 0,
        updated: 0,
        kept: 1,
        sources: ["✓ South Australian State Dance Sport (SASDS): 0 event(s)"],
      },
    };
    const result = reconcileLiveWithSeeds(
      [fullOut, other],
      [sasdsSource, fullOutSource],
      live,
    );
    assert.ok(result.comps.some((row) => row.id === "full-out-state-finals-2026"));
    const fullOutLine = result.status.sources.find((line) => line.includes("Full Out"));
    assert.ok(fullOutLine);
    assert.match(fullOutLine ?? "", /1 seed event\(s\) retained/);
  });
});

describe("isBlockedChallengeHtml", () => {
  it("detects SiteGround captcha stubs so seeds are kept instead of a fake 0-event parse", () => {
    const stub =
      '<html><head><meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2Fenter%2F"></head></html>';
    assert.equal(isBlockedChallengeHtml(stub, 202), true);
    assert.equal(isBlockedChallengeHtml("<h2>Adelaide 1</h2><p>Feb 20-22</p>", 200), false);
  });
});
