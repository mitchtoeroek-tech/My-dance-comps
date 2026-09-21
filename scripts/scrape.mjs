#!/usr/bin/env node
/**
 * Daily scrape for My Dance Comps.
 *
 * Usage:
 *   npm run scrape
 *
 * Merges freshly fetched events into src/data/comps.json.
 * If a source is down or the HTML has changed, existing seed rows are kept.
 *
 * Add a source:
 *   1. Append an entry to src/data/sources.json
 *   2. Add a parser below (or reuse html-generic / dance-hub-table)
 *   3. Re-run npm run scrape and eyeball the diff
 *
 * Cron example (Australia/Adelaide 6am):
 *   0 6 * * * cd /path/to/My-dance-comps && npm run scrape
 */

import { load } from "cheerio";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const compsPath = join(root, "src/data/comps.json");
const sourcesPath = join(root, "src/data/sources.json");

const USER_AGENT =
  "MyDanceCompsBot/1.0 (+https://github.com/mitchtoeroek-tech/My-dance-comps; family dance calendar)";

const MONTHS = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isoDate(year, month, day) {
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAussieDateRange(text, fallbackYear = new Date().getFullYear()) {
  const clean = text.replace(/\u2013|\u2014|–|—/g, "-").replace(/\s+/g, " ").trim();
  const full = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i,
  );
  if (full) {
    const start = isoDate(full[3], MONTHS[full[2].toLowerCase()], full[1]);
    const end = isoDate(full[6], MONTHS[full[5].toLowerCase()], full[4]);
    return start && end ? { startDate: start, endDate: end } : null;
  }
  const sameMonth = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s*-+\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (sameMonth) {
    const year = sameMonth[4] || fallbackYear;
    const month = MONTHS[sameMonth[3].toLowerCase()];
    const start = isoDate(year, month, sameMonth[1]);
    const end = isoDate(year, month, sameMonth[2]);
    return start && end ? { startDate: start, endDate: end } : null;
  }
  const twoMonth = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*-+\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (twoMonth) {
    const year = twoMonth[5] || fallbackYear;
    const start = isoDate(year, MONTHS[twoMonth[2].toLowerCase()], twoMonth[1]);
    const end = isoDate(year, MONTHS[twoMonth[4].toLowerCase()], twoMonth[3]);
    return start && end ? { startDate: start, endDate: end } : null;
  }
  const single = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (single) {
    const year = single[3] || fallbackYear;
    const date = isoDate(year, MONTHS[single[2].toLowerCase()], single[1]);
    return date ? { startDate: date, endDate: date } : null;
  }
  const iso = clean.match(/(\d{2})\/(\d{2})\/(\d{4})\s*-+\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (iso) {
    return {
      startDate: `${iso[3]}-${iso[2]}-${iso[1]}`,
      endDate: `${iso[6]}-${iso[5]}-${iso[4]}`,
    };
  }
  return null;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function guessState(text) {
  const t = text.toUpperCase();
  if (/\bNSW\b|NEW SOUTH WALES|SYDNEY|NEWCASTLE/.test(t)) return "NSW";
  if (/\bVIC\b|VICTORIA|MELBOURNE|BALLARAT/.test(t)) return "VIC";
  if (/\bQLD\b|QUEENSLAND|GOLD COAST|CAIRNS|BRISBANE/.test(t)) return "QLD";
  if (/\bWA\b|WESTERN AUSTRALIA|PERTH/.test(t)) return "WA";
  if (/\bNT\b|DARWIN/.test(t)) return "NT";
  if (/\bTAS\b|TASMANIA|HOBART/.test(t)) return "TAS";
  if (/\bACT\b|CANBERRA/.test(t)) return "ACT";
  if (/\bSA\b|SOUTH AUSTRALIA|ADELAIDE|GOOLWA|GOLDEN GROVE|MARION/.test(t))
    return "SA";
  return "SA";
}

function baseComp(partial) {
  return {
    kind: "competition",
    organiser: partial.organiser || "See source",
    organiserUrl: partial.organiserUrl || partial.infoUrl || "",
    venue: partial.venue || partial.suburb || "TBC",
    suburb: partial.suburb || "TBC",
    state: partial.state || "SA",
    registrationOpens: null,
    registrationCloses: null,
    registrationUrl: partial.registrationUrl || partial.infoUrl || "",
    infoUrl: partial.infoUrl || "",
    styles: partial.styles || [
      "Ballet",
      "Jazz",
      "Tap",
      "Contemporary",
      "Lyrical",
      "Hip Hop",
    ],
    minAge: 5,
    maxAge: 18,
    isNational: Boolean(partial.isNational),
    notes: partial.notes || "Dates scraped automatically — confirm on the organiser site.",
    sourceId: partial.sourceId,
    lastUpdated: new Date().toISOString().slice(0, 10),
    ...partial,
  };
}

async function parseSasds(source) {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const text = $("body").text();
  const range = parseAussieDateRange(text, 2026);
  const open = text.match(
    /open(?:ing)?\s+(?:at\s+[\d:apm\s]+on\s+)?(?:Tuesday\s+)?(\d{1,2}\w*\s+\w+\s+\d{4})/i,
  );
  const close = text.match(
    /close\s+(\d{1,2}:\d{2}\w*)?\s*(?:Friday\s+)?(\d{1,2}\w*\s+\w+\s+\d{4})/i,
  );
  if (!range) return [];
  return [
    baseComp({
      id: `sasds-eisteddfod-${range.startDate.slice(0, 4)}`,
      name: `SASDS Eisteddfod ${range.startDate.slice(0, 4)}`,
      kind: "eisteddfod",
      organiser: source.name,
      organiserUrl: source.url,
      venue: "Westminster School",
      suburb: "Marion",
      state: "SA",
      startDate: range.startDate,
      endDate: range.endDate,
      infoUrl: source.scrapeUrl,
      registrationUrl: source.scrapeUrl,
      sourceId: source.id,
      notes: `Scraped from SASDS information page.${open ? ` Entries mentioned: ${open[0]}` : ""}${close ? ` Close mention: ${close[0]}` : ""}`,
    }),
  ];
}

async function parseEvolution(source) {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found = [];
  $("td, li, p, h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 8 || text.length > 180) return;
    const range = parseAussieDateRange(text, 2026);
    if (!range) return;
    const cityMatch = text.match(
      /^(Darwin|Sydney|Adelaide|Townsville|Auckland|Gold Coast|Perth|Yeppoon|Melbourne|Cairns|Brisbane)/i,
    );
    if (!cityMatch) return;
    const city = cityMatch[1];
    found.push(
      baseComp({
        id: `evolution-${slug(city)}-${range.startDate.slice(0, 4)}`,
        name: `Evolution Dance Comp — ${city}`,
        organiser: "Evolution Dance Comp",
        organiserUrl: source.url,
        suburb: city,
        state: guessState(city),
        startDate: range.startDate,
        endDate: range.endDate,
        infoUrl: source.scrapeUrl,
        registrationUrl: source.url,
        sourceId: source.id,
        isNational: /gold coast|final/i.test(city) === false && /final/i.test(text),
      }),
    );
  });
  return uniqueById(found);
}

async function parseCmidc(source) {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found = [];
  $("h1, h2, h3, h4, p, li, div").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!/COMPETITION/i.test(text) && !/\d{2}\/\d{2}\/\d{4}/.test(text)) return;
    const iso = text.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s*-+\s*(\d{2})\/(\d{2})\/(\d{4})/,
    );
    if (!iso) return;
    const startDate = `${iso[3]}-${iso[2]}-${iso[1]}`;
    const endDate = `${iso[6]}-${iso[5]}-${iso[4]}`;
    const place = /goolwa/i.test(text)
      ? "Goolwa"
      : /golden grove/i.test(text)
        ? "Golden Grove"
        : "South Australia";
    found.push(
      baseComp({
        id: `cmidc-${slug(place)}-${startDate}`,
        name: `Count Me In — ${place}`,
        organiser: "Count Me In Dance Competition",
        organiserUrl: source.url,
        suburb: place,
        state: "SA",
        startDate,
        endDate,
        infoUrl: source.scrapeUrl,
        registrationUrl: "https://cmidc.com.au/enter-now",
        sourceId: source.id,
      }),
    );
  });
  return uniqueById(found);
}

async function parseDanceHubTable(source) {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found = [];
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td, th")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 3) return;
    if (/^competition$/i.test(cells[0])) return;
    const [name, location, dates] = cells;
    const range = parseAussieDateRange(dates, 2026);
    if (!name || !range) return;
    found.push(
      baseComp({
        id: `${slug(name)}-${slug(location)}-${range.startDate}`,
        name: `${name} — ${location}`,
        organiser: name,
        organiserUrl: source.url,
        suburb: location,
        state: guessState(`${location} ${source.region}`),
        startDate: range.startDate,
        endDate: range.endDate,
        infoUrl: source.scrapeUrl,
        registrationUrl: source.scrapeUrl,
        sourceId: source.id,
        notes: `Listed by Dance Hub Australia. Confirm dates and entries with the organiser.`,
      }),
    );
  });
  return uniqueById(found);
}

async function parseGeneric(source) {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found = [];
  $("li, p, td, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 16 || text.length > 220) return;
    const range = parseAussieDateRange(text, 2026);
    if (!range) return;
    if (!/dance|eisteddfod|comp/i.test(text)) return;
    found.push(
      baseComp({
        id: `${source.id}-${range.startDate}-${slug(text).slice(0, 40)}`,
        name: text.slice(0, 90),
        organiser: source.name,
        organiserUrl: source.url,
        suburb: source.region === "National" ? "Australia" : source.region,
        state: guessState(`${text} ${source.region}`),
        startDate: range.startDate,
        endDate: range.endDate,
        infoUrl: source.scrapeUrl,
        registrationUrl: source.url,
        sourceId: source.id,
      }),
    );
  });
  return uniqueById(found).slice(0, 25);
}

function uniqueById(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

function mergeComps(seed, scraped) {
  const byId = new Map(seed.map((row) => [row.id, row]));
  let added = 0;
  let updated = 0;
  for (const row of scraped) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      added += 1;
      continue;
    }
    const next = {
      ...existing,
      startDate: row.startDate || existing.startDate,
      endDate: row.endDate || existing.endDate,
      venue: row.venue || existing.venue,
      suburb: row.suburb || existing.suburb,
      lastUpdated: row.lastUpdated,
    };
    byId.set(row.id, next);
    updated += 1;
  }
  const comps = [...byId.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return { comps, added, updated };
}

const parsers = {
  sasds: parseSasds,
  evolution: parseEvolution,
  cmidc: parseCmidc,
  "dance-hub-table": parseDanceHubTable,
  "html-generic": parseGeneric,
  "seed-only": async () => [],
};

async function main() {
  const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
  const seed = JSON.parse(readFileSync(compsPath, "utf8"));
  const scraped = [];
  const report = [];

  for (const source of sources) {
    const parser = parsers[source.parser] || parseGeneric;
    try {
      const rows = await parser(source);
      scraped.push(...rows);
      report.push(`✓ ${source.name}: ${rows.length} event(s)`);
    } catch (error) {
      report.push(`✗ ${source.name}: ${error.message}`);
    }
  }

  const { comps, added, updated } = mergeComps(seed, scraped);
  writeFileSync(compsPath, `${JSON.stringify(comps, null, 2)}\n`);
  console.log(report.join("\n"));
  console.log(
    `\nWrote ${comps.length} comps to src/data/comps.json (${added} added, ${updated} matched/updated). Seed rows are never deleted.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
