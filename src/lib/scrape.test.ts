import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAussieDateRange, parseFullOutHtml } from "./scrape";
import type { CompSource } from "./types";

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
