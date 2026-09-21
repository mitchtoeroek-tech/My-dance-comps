import { load } from "cheerio";
import type {
  AuStateCode,
  CompKind,
  CompSource,
  Competition,
  DanceStyle,
} from "./types";

export const USER_AGENT =
  "MyDanceCompsBot/1.0 (+https://github.com/mitchtoeroek-tech/My-dance-comps; family dance calendar)";

const MONTHS: Record<string, string> = {
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

export interface ScrapeStatus {
  lastRunAt: string;
  lastFetchedAt: string;
  timezone: "Australia/Adelaide";
  added: number;
  updated: number;
  kept: number;
  sources: string[];
}

export interface ScrapeResult {
  comps: Competition[];
  status: ScrapeStatus;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isoDate(year: string | number, month?: string, day?: string) {
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseAussieDateRange(
  text: string,
  fallbackYear = new Date().getFullYear(),
): { startDate: string; endDate: string } | null {
  const clean = text.replace(/\u2013|\u2014|–|—/g, "-").replace(/\s+/g, " ").trim();
  const full = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i,
  );
  if (full) {
    const start = isoDate(full[3], MONTHS[full[2].toLowerCase()], full[1]);
    const end = isoDate(full[6], MONTHS[full[5].toLowerCase()], full[4]);
    if (start && end) return { startDate: start, endDate: end };
  }
  const sameMonth = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s*-+\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (sameMonth && MONTHS[sameMonth[3].toLowerCase()]) {
    const year = sameMonth[4] || fallbackYear;
    const month = MONTHS[sameMonth[3].toLowerCase()];
    const start = isoDate(year, month, sameMonth[1]);
    const end = isoDate(year, month, sameMonth[2]);
    if (start && end) return { startDate: start, endDate: end };
  }
  const twoMonth = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*-+\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (twoMonth && MONTHS[twoMonth[2].toLowerCase()] && MONTHS[twoMonth[4].toLowerCase()]) {
    const year = twoMonth[5] || fallbackYear;
    const start = isoDate(year, MONTHS[twoMonth[2].toLowerCase()], twoMonth[1]);
    const end = isoDate(year, MONTHS[twoMonth[4].toLowerCase()], twoMonth[3]);
    if (start && end) return { startDate: start, endDate: end };
  }
  const monthFirstTwo = clean.match(
    /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*-+\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i,
  );
  if (
    monthFirstTwo &&
    MONTHS[monthFirstTwo[1].toLowerCase()] &&
    MONTHS[monthFirstTwo[3].toLowerCase()]
  ) {
    const year = monthFirstTwo[5] || fallbackYear;
    const start = isoDate(year, MONTHS[monthFirstTwo[1].toLowerCase()], monthFirstTwo[2]);
    const end = isoDate(year, MONTHS[monthFirstTwo[3].toLowerCase()], monthFirstTwo[4]);
    if (start && end) return { startDate: start, endDate: end };
  }
  const monthFirstSame = clean.match(
    /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*-+\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i,
  );
  if (monthFirstSame && MONTHS[monthFirstSame[1].toLowerCase()]) {
    const year = monthFirstSame[4] || fallbackYear;
    const month = MONTHS[monthFirstSame[1].toLowerCase()];
    const start = isoDate(year, month, monthFirstSame[2]);
    const end = isoDate(year, month, monthFirstSame[3]);
    if (start && end) return { startDate: start, endDate: end };
  }
  const single = clean.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?/i,
  );
  if (single && MONTHS[single[2].toLowerCase()]) {
    const year = single[3] || fallbackYear;
    const date = isoDate(year, MONTHS[single[2].toLowerCase()], single[1]);
    if (date) return { startDate: date, endDate: date };
  }
  const monthFirstSingle = clean.match(
    /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i,
  );
  if (monthFirstSingle && MONTHS[monthFirstSingle[1].toLowerCase()]) {
    const year = monthFirstSingle[3] || fallbackYear;
    const date = isoDate(year, MONTHS[monthFirstSingle[1].toLowerCase()], monthFirstSingle[2]);
    if (date) return { startDate: date, endDate: date };
  }
  const iso = clean.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s*-+\s*(\d{2})\/(\d{2})\/(\d{4})/,
  );
  if (iso) {
    return {
      startDate: `${iso[3]}-${iso[2]}-${iso[1]}`,
      endDate: `${iso[6]}-${iso[5]}-${iso[4]}`,
    };
  }
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const html = await res.text();
  if (isBlockedChallengeHtml(html, res.status)) {
    throw new Error(`Blocked by bot challenge (${res.status}) for ${url}`);
  }
  return html;
}

export function isBlockedChallengeHtml(html: string, status = 200): boolean {
  return (
    status === 202 ||
    /sgcaptcha|sg-captcha|just a moment\.{0,3}please wait/i.test(html)
  );
}

function guessState(text: string): AuStateCode {
  const t = text.toUpperCase();
  if (/\bNSW\b|NEW SOUTH WALES|SYDNEY|NEWCASTLE/.test(t)) return "NSW";
  if (/\bVIC\b|VICTORIA|MELBOURNE|BALLARAT|GLADSTONE PARK/.test(t)) return "VIC";
  if (/\bQLD\b|QUEENSLAND|GOLD COAST|CAIRNS|BRISBANE|BROADBEACH/.test(t)) return "QLD";
  if (/\bWA\b|WESTERN AUSTRALIA|PERTH|MORLEY/.test(t)) return "WA";
  if (/\bNT\b|DARWIN/.test(t)) return "NT";
  if (/\bTAS\b|TASMANIA|HOBART/.test(t)) return "TAS";
  if (/\bACT\b|CANBERRA|GUNGAHLIN/.test(t)) return "ACT";
  if (/\bSA\b|SOUTH AUSTRALIA|ADELAIDE|GOLDEN GROVE|REYNELLA|MILLICENT|MARION/.test(t)) {
    return "SA";
  }
  return "SA";
}

function baseComp(partial: Partial<Competition> & Pick<Competition, "id" | "name" | "sourceId" | "startDate" | "endDate">): Competition {
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: "competition",
    organiser: "See source",
    organiserUrl: "",
    venue: partial.suburb || "TBC",
    suburb: "TBC",
    state: "SA",
    registrationOpens: null,
    registrationCloses: null,
    registrationUrl: "",
    infoUrl: "",
    styles: ["Ballet", "Jazz", "Tap", "Contemporary", "Lyrical", "Hip Hop"],
    minAge: 5,
    maxAge: 18,
    isNational: false,
    notes: "Dates scraped automatically — confirm on the organiser site.",
    lastUpdated: today,
    ...partial,
  };
}

async function parseSasds(source: CompSource): Promise<Competition[]> {
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
      kind: "eisteddfod" as CompKind,
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

async function parseEvolution(source: CompSource): Promise<Competition[]> {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found: Competition[] = [];
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
        isNational: /final/i.test(text),
      }),
    );
  });
  return uniqueById(found);
}

async function parseCmidc(source: CompSource): Promise<Competition[]> {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found: Competition[] = [];
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

const FULL_OUT_STYLES: DanceStyle[] = [
  "Ballet",
  "Character",
  "Lyrical",
  "Jazz",
  "Contemporary",
  "Broadway Jazz",
  "Musical Theatre",
  "Hip Hop",
  "Acro",
  "Tap",
  "Song and Tap",
  "Song and Dance",
];

const FULL_OUT_PLACES: {
  test: RegExp;
  label: string;
  suburb: string;
  venue: string;
  state: AuStateCode;
  kind?: CompKind;
}[] = [
  {
    test: /state\s*finals|\breynella\b|futures events/i,
    label: "State Finals",
    suburb: "Reynella",
    venue: "Futures Events Centre",
    state: "SA",
    kind: "nationals",
  },
  {
    test: /adelaide\s*2/i,
    label: "Adelaide 2",
    suburb: "Golden Grove",
    venue: "Golden Grove Arts Centre",
    state: "SA",
  },
  {
    test: /adelaide\s*1/i,
    label: "Adelaide 1",
    suburb: "Golden Grove",
    venue: "Golden Grove Arts Centre",
    state: "SA",
  },
  {
    test: /gold\s*coast|\bbroadbeach\b/i,
    label: "Gold Coast",
    suburb: "Broadbeach",
    venue: "Broadbeach Cultural Centre",
    state: "QLD",
  },
  {
    test: /\bperth\b|\bmorley\b/i,
    label: "Perth",
    suburb: "Morley",
    venue: "Morley Sport & Recreation",
    state: "WA",
  },
  {
    test: /\bmillicent\b/i,
    label: "Millicent",
    suburb: "Millicent",
    venue: "Millicent Civic Arts",
    state: "SA",
  },
  {
    test: /\bdarwin\b/i,
    label: "Darwin",
    suburb: "Darwin",
    venue: "Charles Darwin University",
    state: "NT",
  },
  {
    test: /\bmelbourne\b|\bgladstone park\b/i,
    label: "Melbourne",
    suburb: "Gladstone Park",
    venue: "Gladstone Park Secondary College",
    state: "VIC",
  },
  {
    test: /\bcanberra\b|\bgungahlin\b/i,
    label: "Canberra",
    suburb: "Gungahlin",
    venue: "Gungahlin College Performing Arts Centre",
    state: "ACT",
  },
];

function parseEtLinkOptions(html: string): Record<string, string> {
  const match = html.match(/var et_link_options_data\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return {};
  try {
    const rows = JSON.parse(match[1]) as { class?: string; url?: string }[];
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.class && row.url) map[row.class] = row.url;
    }
    return map;
  } catch {
    return {};
  }
}

function fullOutDivision(text: string): string {
  const troupes = /\btroupes\b/i.test(text);
  const solos = /\bsolos?\b|\bduos?\b/i.test(text);
  if (troupes && !solos) return "Troupes";
  if (solos && !troupes) return "Solos/Duos";
  return "";
}

function fullOutEntryNote(text: string): string {
  if (/sold\s*out/i.test(text)) {
    return "Entries listed as sold out on fullout.com.au/enter/. Email dance@fullout.com.au for the waitlist.";
  }
  if (/coming\s*soon/i.test(text)) {
    return "Entries coming soon on fullout.com.au/enter/.";
  }
  if (/entries\s*open/i.test(text)) {
    return "Entries open on the organiser site — confirm on fullout.com.au/enter/ before you enter.";
  }
  return "Dates from fullout.com.au/enter/. Confirm on the organiser site before you enter.";
}

function visibleCardText($: ReturnType<typeof load>, el: unknown): string {
  const html = $(el as never).html() ?? "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(h\d|p|div|li|span)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function detectFullOutYear($: ReturnType<typeof load>, fallbackYear: number): number {
  const cards: string[] = [];
  $(".et_pb_text_inner").each((_, el) => {
    cards.push(visibleCardText($, el));
  });
  for (const text of cards) {
    if (/waitlist/i.test(text)) {
      const year = text.match(/\b(20\d{2})\b/);
      if (year) return Number(year[1]);
    }
    if (/^20\d{2}$/.test(text)) return Number(text);
  }
  return fallbackYear;
}

/** Best-effort parse of Full Out (Australia) enter cards. Source: fullout.com.au only. */
export function parseFullOutHtml(
  html: string,
  source: CompSource,
  fetchedAt = new Date(),
): Competition[] {
  const $ = load(html);
  const links = parseEtLinkOptions(html);
  const fallbackYear = detectFullOutYear($, fetchedAt.getFullYear());
  const lastFetchedAt = fetchedAt.toISOString();
  const found: Competition[] = [];

  $(".et_pb_text_inner").each((_, el) => {
    const text = visibleCardText($, el);
    if (text.length < 12 || text.length > 400) return;
    if (/waitlist requests|website design/i.test(text)) return;
    const range = parseAussieDateRange(text, fallbackYear);
    if (!range) return;
    const place = FULL_OUT_PLACES.find((row) => row.test.test(text));
    if (!place) return;

    const division = /state\s*finals/i.test(text) ? "" : fullOutDivision(text);
    const display = division ? `${place.label} ${division}` : place.label;
    const parentClass = $(el).closest(".et_pb_text").attr("class") || "";
    const classKey = parentClass.match(/et_pb_text_\d+/)?.[0];
    const portal = (classKey && links[classKey]) || "";
    const registrationUrl = portal || source.scrapeUrl;

    found.push(
      baseComp({
        id: `full-out-${slug(display)}-${range.startDate.slice(0, 4)}`,
        name: `Full Out — ${display}`,
        kind: place.kind ?? "competition",
        organiser: "Full Out",
        organiserUrl: source.url,
        venue: place.venue,
        suburb: place.suburb,
        state: place.state,
        startDate: range.startDate,
        endDate: range.endDate,
        registrationUrl,
        infoUrl: source.scrapeUrl,
        styles: FULL_OUT_STYLES,
        minAge: 5,
        maxAge: 18,
        sourceId: source.id,
        notes: fullOutEntryNote(text),
        lastFetchedAt,
      }),
    );
  });

  return uniqueById(found);
}

async function parseFullOut(source: CompSource): Promise<Competition[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const html = await fetchHtml(source.scrapeUrl);
  return parseFullOutHtml(html, source);
}

async function parseDanceHubTable(source: CompSource): Promise<Competition[]> {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found: Competition[] = [];
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
        notes:
          "Listed by Dance Hub Australia. Confirm dates and entries with the organiser.",
      }),
    );
  });
  return uniqueById(found);
}

async function parseGeneric(source: CompSource): Promise<Competition[]> {
  const html = await fetchHtml(source.scrapeUrl);
  const $ = load(html);
  const found: Competition[] = [];
  $("li, p, td, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 16 || text.length > 220) return;
    const range = parseAussieDateRange(text, 2026);
    if (!range) return;
    if (!/dance|eisteddfod|comp|challenge|festival|championship/i.test(text))
      return;
    if (/intensive|syllabus/i.test(text)) return;
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

function uniqueById(rows: Competition[]): Competition[] {
  const map = new Map<string, Competition>();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/—|-|–/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findExisting(
  byId: Map<string, Competition>,
  row: Competition,
): Competition | undefined {
  const exact = byId.get(row.id);
  if (exact) return exact;
  const needle = normaliseName(row.name);
  for (const existing of byId.values()) {
    if (existing.startDate !== row.startDate) continue;
    if (existing.state !== row.state) continue;
    const hay = normaliseName(existing.name);
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
      return existing;
    }
  }
  return undefined;
}

export function mergeComps(
  seed: Competition[],
  scraped: Competition[],
): { comps: Competition[]; added: number; updated: number } {
  const byId = new Map(seed.map((row) => [row.id, row]));
  let added = 0;
  let updated = 0;
  for (const row of scraped) {
    const existing = findExisting(byId, row);
    if (!existing) {
      byId.set(row.id, row);
      added += 1;
      continue;
    }
    const next = { ...existing };
    let changed = false;
    if (row.startDate && row.startDate !== existing.startDate) {
      next.startDate = row.startDate;
      changed = true;
    }
    if (row.endDate && row.endDate !== existing.endDate) {
      next.endDate = row.endDate;
      changed = true;
    }
    if (row.venue && row.venue !== existing.venue && row.venue !== "TBC") {
      next.venue = row.venue;
      changed = true;
    }
    if (row.suburb && row.suburb !== existing.suburb && row.suburb !== "TBC") {
      next.suburb = row.suburb;
      changed = true;
    }
    if (row.registrationUrl && row.registrationUrl !== existing.registrationUrl) {
      next.registrationUrl = row.registrationUrl;
      changed = true;
    }
    if (row.lastFetchedAt && row.lastFetchedAt !== existing.lastFetchedAt) {
      next.lastFetchedAt = row.lastFetchedAt;
      changed = true;
    }
    if (changed) {
      next.lastUpdated = row.lastUpdated;
      byId.set(existing.id, next);
      updated += 1;
    }
  }
  const comps = [...byId.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return { comps, added, updated };
}

/** Re-apply the current seed file onto a (possibly stale) live scrape. */
export function reconcileLiveWithSeeds(
  seed: Competition[],
  sources: CompSource[],
  live: ScrapeResult,
): ScrapeResult {
  const { comps, added, updated } = mergeComps(seed, live.comps);
  const report = [...live.status.sources];
  for (const source of sources) {
    if (report.some((line) => line.includes(source.name))) continue;
    const n = seed.filter((row) => row.sourceId === source.id).length;
    report.push(
      n > 0
        ? `✓ ${source.name}: ${n} seed event(s) retained (missing from last live scrape)`
        : `✓ ${source.name}: 0 event(s) (not in last live scrape)`,
    );
  }
  return {
    comps,
    status: {
      ...live.status,
      added,
      updated,
      kept: comps.length - added,
      sources: report,
    },
  };
}

type Parser = (source: CompSource) => Promise<Competition[]>;

const parsers: Record<CompSource["parser"], Parser> = {
  sasds: parseSasds,
  evolution: parseEvolution,
  cmidc: parseCmidc,
  "full-out": parseFullOut,
  "dance-hub-table": parseDanceHubTable,
  "html-generic": parseGeneric,
  "seed-only": async () => [],
};

export async function scrapeAll(
  seed: Competition[],
  sources: CompSource[],
): Promise<ScrapeResult> {
  const scraped: Competition[] = [];
  const report: string[] = [];

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      try {
        const parser = parsers[source.parser] ?? parseGeneric;
        const rows = await parser(source);
        return { source, rows, error: null as string | null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { source, rows: [] as Competition[], error: message };
      }
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") {
      report.push(`✗ ${String(result.reason)}`);
      continue;
    }
    const { source, rows, error } = result.value;
    const seedCount = seed.filter((row) => row.sourceId === source.id).length;
    if (error) {
      report.push(
        seedCount > 0
          ? `✗ ${source.name}: ${error} (${seedCount} seed event(s) retained)`
          : `✗ ${source.name}: ${error}`,
      );
      continue;
    }
    scraped.push(...rows);
    const fetched = rows.find((row) => row.lastFetchedAt)?.lastFetchedAt;
    if (rows.length === 0 && seedCount > 0) {
      report.push(
        `✓ ${source.name}: 0 event(s) scraped; ${seedCount} seed event(s) retained`,
      );
    } else if (fetched) {
      report.push(
        `✓ ${source.name}: ${rows.length} event(s) (lastFetchedAt ${fetched})`,
      );
    } else {
      report.push(`✓ ${source.name}: ${rows.length} event(s)`);
    }
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const currentScraped = scraped.filter((row) => row.endDate >= cutoff);

  const { comps, added, updated } = mergeComps(seed, currentScraped);
  const lastFetchedAt = new Date().toISOString();
  return {
    comps,
    status: {
      lastRunAt: lastFetchedAt,
      lastFetchedAt,
      timezone: "Australia/Adelaide",
      added,
      updated,
      kept: comps.length - added,
      sources: report,
    },
  };
}
