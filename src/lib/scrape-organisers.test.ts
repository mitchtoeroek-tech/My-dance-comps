import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCanDancePages,
  parseDanceLifePages,
  parseGtbPages,
  parseJumpPages,
  parseShowcasePages,
  parseSupremeHtml,
  parseTalentTribeHtml,
  parseTimeToShineHtml,
} from "./scrape-organisers";
import type { CompSource } from "./types";

function source(partial: Partial<CompSource> & Pick<CompSource, "id" | "parser">): CompSource {
  return {
    name: partial.id,
    url: "https://example.com",
    scrapeUrl: "https://example.com/dates",
    notes: "",
    region: "National",
    ...partial,
  };
}

describe("parseGtbPages", () => {
  it("reads 2027 tour stops and the Sunshine Coast finals", () => {
    const tour = `
      <a href="https://www.gtbdance.com/event-details/gtb-adelaide-2027">GTB ADELAIDE 2027</a>
      <p>GTB ADELAIDE 2027</p>
      <p>Thu, 11 Feb</p>
      <p>Golden Grove Recreation &amp; Arts Centre</p>
      <p>SOLD OUT</p>
      <p>GTB NOOSA 2027</p>
      <p>Sat, 27 Feb</p>
      <p>St Teresa's Catholic College</p>
      <p>ENTER HERE</p>
    `;
    const finals = `<p>DATES: SEPTEMBER 24 - OCTOBER 1, 2026</p><p>FLINDERS PERFORMANCE CENTRE, SUNSHINE COAST QLD</p>`;
    const rows = parseGtbPages(tour, finals, source({ id: "gtb", parser: "gtb", url: "https://www.gtbdance.com" }));
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    assert.equal(byId["gtb-adelaide-2027"].state, "SA");
    assert.equal(byId["gtb-adelaide-2027"].suburb, "Golden Grove");
    assert.equal(byId["gtb-adelaide-2027"].startDate, "2027-02-11");
    assert.equal(
      byId["gtb-adelaide-2027"].registrationUrl,
      "https://www.gtbdance.com/event-details/gtb-adelaide-2027",
    );
    assert.match(byId["gtb-adelaide-2027"].notes, /sold out/i);
    assert.equal(byId["gtb-noosa-2027"].state, "QLD");
    assert.equal(byId["gtb-finals-2026"].isNational, true);
    assert.equal(byId["gtb-finals-2026"].endDate, "2026-10-01");
  });
});

describe("parseTimeToShineHtml", () => {
  it("keeps located events and skips a venue-less heat", () => {
    const html = `
      <table class="competition_list"><tr><td>
        <a class="competiton_link" href="https://www.ttsdc.com.au/">TIME TO SHINE, (HEAT Z) NOOSA 2, TROUPES</a>
        <a class="competiton_link" href="https://www.ttsdc.com.au/">St Theresas Catholic College, Noosaville QLD</a>
        <span id="LabelHeldDateFrom_0">07 Nov 2026</span>
        <span id="LabelHeldDateTo_0">07 Nov 2026</span>
        <span id="LabelCutoffDate_0">07 Oct 2026</span>
      </td></tr></table>
      <table class="competition_list"><tr><td>
        <a class="competiton_link" href="https://www.ttsdc.com.au/">TIME TO SHINE, (HEAT Z2) TBC SOLOS</a>
        <span id="LabelHeldDateFrom_1">12 Dec 2026</span>
        <span id="LabelHeldDateTo_1">13 Dec 2026</span>
        <span id="LabelCutoffDate_1">13 Nov 2026</span>
      </td></tr></table>
    `;
    const rows = parseTimeToShineHtml(
      html,
      source({
        id: "time-to-shine",
        parser: "time-to-shine",
        url: "https://www.ttsdc.com.au",
        scrapeUrl: "https://www.comps-online.com.au/Competition_Home.aspx?Organiser=OR000049",
      }),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, "QLD");
    assert.equal(rows[0].suburb, "Noosaville");
    assert.equal(rows[0].startDate, "2026-11-07");
    assert.equal(rows[0].registrationCloses, "2026-10-07T17:00:00");
  });
});

describe("parseDanceLifePages", () => {
  it("reads MyCompHQ cards and a solo-nationals close date", () => {
    const events = `
      <div class="event-card">
        <h2>Nationals Solos</h2>
        <div class="event-date">2nd Jan '27 - 4th Jan '27</div>
        <a class="btn btn-performer" href="https://DanceLifeUniteNationalsSolos.MyCompHQ.com.au/performers">Performers</a>
      </div>
      <div class="event-card">
        <h2>Sydney Solos</h2>
        <div class="event-date">22nd Aug '26 - 23rd Aug '26</div>
        <a class="btn btn-performer" href="https://DanceLifeUniteSydneySolos.MyCompHQ.com.au/performers">Performers</a>
      </div>
    `;
    const home = `<p>SOLO NATIONALS 2-4 JAN – ENTER NOW – CLOSING 1ST NOVEMBER</p>`;
    const rows = parseDanceLifePages(
      events,
      home,
      source({ id: "dancelife", parser: "dancelife", url: "https://www.dancelifeunite.com.au" }),
    );
    const solos = rows.find((row) => row.id === "dancelife-nationals-solos-2027-01-02");
    const sydney = rows.find((row) => row.state === "NSW" && !row.isNational);
    assert.ok(solos);
    assert.equal(solos?.isNational, true);
    assert.equal(solos?.startDate, "2027-01-02");
    assert.equal(solos?.endDate, "2027-01-04");
    assert.equal(solos?.registrationCloses, "2026-11-01T17:00:00");
    assert.equal(sydney?.suburb, "Sydney");
  });
});

describe("other organiser parsers", () => {
  it("reads Supreme, CanDance, Showcase, Talent Tribe and Jump", () => {
    const supreme = parseSupremeHtml(
      `<p>ADELAIDE 2026</p><p>Sat, 29 Aug</p><p>Golden Grove</p><p>SOLD OUT</p>`,
      source({ id: "supreme", parser: "supreme", url: "https://www.supremedancecomp.com" }),
    );
    assert.equal(supreme[0].state, "SA");
    assert.equal(supreme[0].startDate, "2026-08-29");

    const candance = parseCanDancePages(
      `<p>DATES 4-6 JULY 2026</p><p>CLOSE TUESDAY 10 MARCH at 5:00pm</p><p>PRINCE ALFRED COLLEGE KENT TOWN</p><p>ENTRIES NOW CLOSED</p>`,
      `<p>DATES OCTOBER 2026</p><p>CLOSE TUESDAY 4 AUGUST</p><p>GOLDEN GROVE</p>`,
      source({ id: "candance", parser: "candance", url: "https://www.candanceaustralia.com.au" }),
    );
    assert.equal(candance.length, 1);
    assert.equal(candance[0].startDate, "2026-07-04");
    assert.equal(candance[0].endDate, "2026-07-06");
    assert.equal(candance[0].state, "SA");

    const showcase = parseShowcasePages(
      `<table class="gridview"><tr>
        <td>January 11 - January 18</td><td>QLD</td><td>The Star Casino Gold Coast Broadbeach QLD</td>
      </tr><tr>
        <td>July 06 - July 15</td><td>NSW</td><td>Carnival Splendour Sydney</td>
      </tr></table>`,
      `<h1>FINALS JAN 2027</h1>`,
      source({ id: "showcase", parser: "showcase", url: "https://www.showcasedance.com" }),
    );
    assert.equal(showcase.length, 1);
    assert.equal(showcase[0].startDate, "2027-01-11");
    assert.equal(showcase[0].endDate, "2027-01-18");
    assert.equal(showcase[0].state, "QLD");

    const tribe = parseTalentTribeHtml(
      `<p>2027 National Finals</p><p>13-18 April 2027</p><p>The Governors Centre, Moore Park NSW</p>`,
      source({ id: "talent-tribe", parser: "talent-tribe", url: "https://www.talenttribe.com.au" }),
    );
    assert.equal(tribe[0].startDate, "2027-04-13");
    assert.equal(tribe[0].suburb, "Moore Park");

    const jump = parseJumpPages(
      `<p>Season 3 National Championships held from 9th - 13th December 2026 in Gold Coast, Queensland.</p><p>DREAM CENTRE, CARRARA, GOLD COAST</p>`,
      `<a href="https://jump-dance-challenge-nationals-2026.compadminpro.com/">Enter</a>`,
      source({ id: "jump", parser: "jump", url: "https://www.jumpdancechallenge.com.au" }),
    );
    assert.equal(jump[0].startDate, "2026-12-09");
    assert.equal(jump[0].suburb, "Carrara");
    assert.equal(jump[0].state, "QLD");
    assert.match(jump[0].registrationUrl, /compadminpro/);
  });
});
