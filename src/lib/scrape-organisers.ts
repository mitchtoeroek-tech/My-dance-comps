import { load } from "cheerio";
import { baseComp, parseAussieDateRange } from "./scrape.ts";
import type { AuStateCode, CompSource, Competition, DanceStyle } from "./types";

const YOUTH_STYLES: DanceStyle[] = [
  "Ballet",
  "Jazz",
  "Tap",
  "Contemporary",
  "Lyrical",
  "Hip Hop",
  "Musical Theatre",
  "Acro",
];

const GTB_STYLES: DanceStyle[] = [
  ...YOUTH_STYLES,
  "Broadway Jazz",
  "Song and Dance",
];

const PLACE_RULES: { test: RegExp; suburb: string; state: AuStateCode }[] = [
  { test: /golden grove/i, suburb: "Golden Grove", state: "SA" },
  { test: /kent town|prince alfred/i, suburb: "Kent Town", state: "SA" },
  { test: /elizabeth|shedley/i, suburb: "Elizabeth", state: "SA" },
  { test: /adelaide/i, suburb: "Adelaide", state: "SA" },
  { test: /noosaville|noosa|st teresa/i, suburb: "Noosaville", state: "QLD" },
  { test: /caboolture/i, suburb: "Caboolture", state: "QLD" },
  { test: /yeppoon/i, suburb: "Yeppoon", state: "QLD" },
  { test: /mackay|ooralea/i, suburb: "Mackay", state: "QLD" },
  { test: /sunshine coast|buderim|flinders performance/i, suburb: "Buderim", state: "QLD" },
  { test: /carrara|dream centre/i, suburb: "Carrara", state: "QLD" },
  { test: /gold coast|broadbeach/i, suburb: "Broadbeach", state: "QLD" },
  { test: /tweed/i, suburb: "Tweed Heads", state: "NSW" },
  { test: /engadine/i, suburb: "Engadine", state: "NSW" },
  { test: /moore park|governors centre/i, suburb: "Moore Park", state: "NSW" },
  { test: /sydney/i, suburb: "Sydney", state: "NSW" },
  { test: /canberra/i, suburb: "Canberra", state: "ACT" },
  { test: /central coast/i, suburb: "Central Coast", state: "NSW" },
  { test: /brisbane/i, suburb: "Brisbane", state: "QLD" },
  { test: /perth/i, suburb: "Perth", state: "WA" },
  { test: /hobart/i, suburb: "Hobart", state: "TAS" },
  { test: /noble park/i, suburb: "Noble Park", state: "VIC" },
  { test: /melbourne|gladstone park/i, suburb: "Melbourne", state: "VIC" },
  { test: /darwin/i, suburb: "Darwin", state: "NT" },
  { test: /townsville/i, suburb: "Townsville", state: "QLD" },
  { test: /cairns/i, suburb: "Cairns", state: "QLD" },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function htmlLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|td|th|span|a)>/gi, "\n");
  const $ = load(withBreaks);
  return $("body")
    .text()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function placeFrom(text: string): { suburb: string; state: AuStateCode } | null {
  const rule = PLACE_RULES.find((item) => item.test.test(text));
  return rule ? { suburb: rule.suburb, state: rule.state } : null;
}

function normaliseTicketDates(text: string): string {
  return text
    .replace(/\u2013|\u2014|–|—/g, "-")
    .replace(/,/g, " ")
    .replace(/'(\d{2})\b/g, " 20$1")
    .replace(/\s+/g, " ")
    .trim();
}

function endOfDay(isoDate: string): string {
  return `${isoDate}T17:00:00`;
}

function closeBeforeEvent(startDate: string, closeDate: string): string {
  return closeDate >= startDate
    ? endOfDay(`${Number(startDate.slice(0, 4)) - 1}${closeDate.slice(4, 10)}`)
    : endOfDay(closeDate);
}

function linkByText(html: string): Map<string, string> {
  const $ = load(html);
  const map = new Map<string, string>();
  $("a[href]").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
    const href = ($(el).attr("href") || "").trim();
    if (text && /^https?:/i.test(href)) map.set(text, href);
  });
  return map;
}

const WEEKDAY_DATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+\d{1,2}\s+[A-Za-z]+/i;
const STATUS_LINE = /^(sold out|enter here|waitlist|rsvp closed|opening soon)$/i;

interface HeadingEvent {
  title: string;
  year: number;
  dateLine: string;
  venue: string;
  status: string;
  range: { startDate: string; endDate: string };
}

function parseHeadingEvents(
  lines: string[],
  heading: RegExp,
  fallbackYear: number,
): HeadingEvent[] {
  const found: HeadingEvent[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].match(heading);
    if (!head) continue;
    const year = Number(head[2] || fallbackYear);
    let dateLine = "";
    let venue = "";
    let status = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j += 1) {
      const line = lines[j];
      if (heading.test(line)) break;
      if (STATUS_LINE.test(line)) {
        status = line;
        continue;
      }
      if (!dateLine && (WEEKDAY_DATE.test(line) || parseAussieDateRange(line, year))) {
        dateLine = line;
        continue;
      }
      if (dateLine && !venue && line.length < 90) venue = line;
    }
    const range = dateLine ? parseAussieDateRange(dateLine, year) : null;
    if (!range) continue;
    found.push({
      title: head[1].replace(/\s+/g, " ").trim(),
      year,
      dateLine,
      venue,
      status,
      range,
    });
  }
  return found;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function entryNote(status: string, where: string): string {
  if (/sold out/i.test(status)) {
    return `Listed as sold out on ${where}.`;
  }
  if (/enter here|open/i.test(status)) {
    return `Entries listed as open on ${where}. Confirm on the organiser site before you enter.`;
  }
  return `Dates from ${where}. Confirm on the organiser site before you enter.`;
}

export function parseGtbPages(
  tourHtml: string,
  finalsHtml: string,
  source: CompSource,
): Competition[] {
  const links = linkByText(tourHtml);
  const rows: Competition[] = [];
  for (const event of parseHeadingEvents(htmlLines(tourHtml), /^GTB (.+?) (20\d{2})$/i, 2027)) {
    const place = placeFrom(`${event.title} ${event.venue}`);
    if (!place) continue;
    const label = titleCase(event.title.replace(/\s+20\d{2}$/i, ""));
    const href =
      links.get(`gtb ${label} ${event.year}`.toLowerCase()) ||
      links.get(event.venue.toLowerCase()) ||
      source.scrapeUrl;
    rows.push(
      baseComp({
        id: `gtb-${slug(label)}-${event.year}`,
        name: `Get the Beat — ${label}`,
        organiser: "Get the Beat",
        organiserUrl: source.url,
        venue: event.venue || place.suburb,
        suburb: place.suburb,
        state: place.state,
        startDate: event.range.startDate,
        endDate: event.range.endDate,
        registrationUrl: href,
        infoUrl: href,
        styles: GTB_STYLES,
        sourceId: source.id,
        notes: entryNote(event.status, "gtbdance.com/2027"),
      }),
    );
  }

  const finalsText = normaliseTicketDates(htmlLines(finalsHtml).join(" "));
  const finalsRange = parseAussieDateRange(
    finalsText.match(
      /(?:September|October)\s+\d{1,2}\s*-\s*(?:September|October)\s+\d{1,2}\s+20\d{2}/i,
    )?.[0] || "",
    2026,
  );
  if (finalsRange && /flinders|sunshine coast/i.test(finalsText)) {
    rows.push(
      baseComp({
        id: `gtb-finals-${finalsRange.startDate.slice(0, 4)}`,
        name: "Get the Beat — Finals",
        kind: "nationals",
        organiser: "Get the Beat",
        organiserUrl: source.url,
        venue: "Flinders Performance Centre",
        suburb: "Buderim",
        state: "QLD",
        startDate: finalsRange.startDate,
        endDate: finalsRange.endDate,
        registrationUrl: "https://www.gtbdance.com/entries",
        infoUrl: "https://www.gtbdance.com/entries",
        styles: GTB_STYLES,
        isNational: true,
        sourceId: source.id,
        notes:
          "GTB Finals dates from gtbdance.com/entries. Confirm on the organiser site before you enter.",
      }),
    );
  }
  return rows;
}

export function parseSupremeHtml(html: string, source: CompSource): Competition[] {
  const links = linkByText(html);
  const rows: Competition[] = [];
  for (const event of parseHeadingEvents(
    htmlLines(html),
    /^(Adelaide|Sydney|Perth|Engadine|Sunshine Coast|Gold Coast|Noosa|Caboolture) (20\d{2})$/i,
    2026,
  )) {
    const place = placeFrom(`${event.title} ${event.venue}`);
    if (!place) continue;
    const href =
      links.get(`${event.title} ${event.year}`.toLowerCase()) ||
      `https://www.supremedancecomp.com/event-details/${slug(event.title)}-${event.year}`;
    rows.push(
      baseComp({
        id: `supreme-${slug(event.title)}-${event.year}`,
        name: `Supreme Dance Experience — ${event.title}`,
        organiser: "Supreme Dance Experience",
        organiserUrl: source.url,
        venue: event.venue || place.suburb,
        suburb: place.suburb,
        state: place.state,
        startDate: event.range.startDate,
        endDate: event.range.endDate,
        registrationUrl: href,
        infoUrl: source.scrapeUrl,
        styles: GTB_STYLES,
        sourceId: source.id,
        notes: entryNote(event.status, "supremedancecomp.com/2026tour"),
      }),
    );
  }
  return rows;
}

export function parseCanDancePages(
  julyHtml: string,
  octoberHtml: string,
  source: CompSource,
): Competition[] {
  const rows: Competition[] = [];
  const july = htmlLines(julyHtml).join(" ");
  const julyDates = july.match(/DATES\s+(\d{1,2}\s*-\s*\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i);
  const julyRange = julyDates ? parseAussieDateRange(julyDates[1], 2026) : null;
  if (julyRange && /kent town|prince alfred/i.test(july)) {
    const close = july.match(
      /CLOSE[A-Z\s]*?(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+)\s+(?:AT\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM))?/i,
    );
    const closeRange = close
      ? parseAussieDateRange(`${close[1]} ${close[2]} ${julyRange.startDate.slice(0, 4)}`, 2026)
      : null;
    rows.push(
      baseComp({
        id: `candance-kent-town-${julyRange.startDate}`,
        name: "CanDance Australia — July",
        organiser: "CanDance Australia",
        organiserUrl: source.url,
        venue: "Prince Alfred College",
        suburb: "Kent Town",
        state: "SA",
        startDate: julyRange.startDate,
        endDate: julyRange.endDate,
        registrationCloses: closeRange ? endOfDay(closeRange.startDate) : null,
        registrationUrl: "https://www.candanceaustralia.com.au/july",
        infoUrl: "https://www.candanceaustralia.com.au/july",
        styles: YOUTH_STYLES,
        sourceId: source.id,
        notes: /entries now closed/i.test(july)
          ? "July dates from candanceaustralia.com.au/july. Entries were listed as closed."
          : "July dates from candanceaustralia.com.au/july. Confirm on the organiser site before you enter.",
      }),
    );
  }

  const october = htmlLines(octoberHtml).join(" ");
  const octoberDates = october.match(
    /DATES\s+(\d{1,2}(?:\s*-\s*\d{1,2})?\s+[A-Za-z]+\s+20\d{2})/i,
  );
  const octoberRange = octoberDates
    ? parseAussieDateRange(octoberDates[1], 2026)
    : null;
  if (octoberRange && /kent town|golden grove|prince alfred/i.test(october)) {
    const close = october.match(
      /CLOSE[A-Z\s]*?(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+)/i,
    );
    const closeRange = close
      ? parseAussieDateRange(
          `${close[1]} ${close[2]} ${octoberRange.startDate.slice(0, 4)}`,
          2026,
        )
      : null;
    const place = /golden grove/i.test(october)
      ? placeFrom("Golden Grove")
      : placeFrom("Kent Town");
    rows.push(
      baseComp({
        id: `candance-${slug(place?.suburb || "sa")}-${octoberRange.startDate}`,
        name: `CanDance Australia — ${place?.suburb || "South Australia"}`,
        organiser: "CanDance Australia",
        organiserUrl: source.url,
        venue: /golden grove/i.test(october)
          ? "Golden Grove Arts Centre"
          : "Prince Alfred College",
        suburb: place?.suburb || "Kent Town",
        state: "SA",
        startDate: octoberRange.startDate,
        endDate: octoberRange.endDate,
        registrationCloses: closeRange
          ? closeBeforeEvent(octoberRange.startDate, closeRange.startDate)
          : null,
        registrationUrl: "https://www.trybooking.com/DKMHC",
        infoUrl: "https://www.candanceaustralia.com.au/october",
        styles: YOUTH_STYLES,
        sourceId: source.id,
        notes:
          "October dates from candanceaustralia.com.au/october. Confirm on the organiser site before you enter.",
      }),
    );
  }
  return rows;
}

export function parsePendulumHtml(html: string, source: CompSource): Competition[] {
  if (/just a moment|cf-browser-verification|challenge-platform/i.test(html)) return [];
  const lines = htmlLines(html);
  const rows: Competition[] = [];
  for (const line of lines) {
    if (line.length < 12 || line.length > 180) continue;
    if (!/comp|eisteddfod|pendulum|shedley/i.test(line)) continue;
    const range = parseAussieDateRange(line, new Date().getFullYear());
    if (!range) continue;
    const place = placeFrom(line) || placeFrom("Elizabeth Shedley");
    if (!place || place.state !== "SA") continue;
    rows.push(
      baseComp({
        id: `pendulum-${range.startDate}`,
        name: "Pendulum Dance Competitions",
        organiser: "Pendulum Dance Competitions",
        organiserUrl: source.url,
        venue: /shedley/i.test(line) ? "Shedley Theatre" : "Shedley Theatre",
        suburb: "Elizabeth",
        state: "SA",
        startDate: range.startDate,
        endDate: range.endDate,
        registrationUrl: source.url,
        infoUrl: source.scrapeUrl,
        styles: YOUTH_STYLES,
        sourceId: source.id,
        notes: "Dates from pendulumdancecomps.com.au. Confirm on the organiser site before you enter.",
      }),
    );
  }
  return rows;
}

export function parseShowcasePages(
  scheduleHtml: string,
  finalsHtml: string,
  source: CompSource,
): Competition[] {
  const yearMatch =
    finalsHtml.match(/FINALS\s+JAN(?:UARY)?\s+(20\d{2})/i) ||
    scheduleHtml.match(/FINALS\s+JAN(?:UARY)?\s+(20\d{2})/i);
  const nationalsYear = yearMatch ? Number(yearMatch[1]) : null;
  const $ = load(scheduleHtml);
  const rows: Competition[] = [];
  $("table.gridview tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 3) return;
    const [dates, , venue] = cells;
    if (!/january/i.test(dates) || !/star|broadbeach/i.test(venue)) return;
    if (!nationalsYear) return;
    const range = parseAussieDateRange(dates, nationalsYear);
    if (!range) return;
    rows.push(
      baseComp({
        id: `showcase-nationals-${nationalsYear}`,
        name: "Showcase — Australian Dance Championships",
        kind: "nationals",
        organiser: "Showcase",
        organiserUrl: source.url,
        venue: "The Star Gold Coast",
        suburb: "Broadbeach",
        state: "QLD",
        startDate: range.startDate,
        endDate: range.endDate,
        registrationUrl: "https://www.showcasedance.com/registration",
        infoUrl: "https://www.showcasedance.com/finals-januarygoldcoast",
        styles: YOUTH_STYLES,
        isNational: true,
        sourceId: source.id,
        notes: `January ${nationalsYear} finals from the Showcase schedule and the Finals Jan ${nationalsYear} page. Qualifying events are listed by partner logo on showcasedance.com/qualifiing-places.`,
      }),
    );
  });
  const byId = new Map<string, Competition>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

function prettyDluName(name: string): string {
  return name
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDanceLifePages(
  eventsHtml: string,
  homeHtml: string,
  source: CompSource,
): Competition[] {
  const $ = load(eventsHtml);
  const home = htmlLines(homeHtml).join(" ");
  const rows: Competition[] = [];
  $(".event-card").each((_, card) => {
    const rawName = $(card).find("h2").first().text().replace(/\s+/g, " ").trim();
    const dateText = normaliseTicketDates(
      $(card).find(".event-date").first().text(),
    );
    const range = parseAussieDateRange(dateText, 2026);
    if (!rawName || !range) return;
    const performer =
      $(card).find("a.btn-performer").attr("href") ||
      $(card).find(".event-url").text().replace(/\s+/g, "").trim() ||
      source.scrapeUrl;
    const label = prettyDluName(rawName);
    const national = /national/i.test(rawName);
    const place = placeFrom(label);
    let registrationCloses: string | null = null;
    if (national && /solo/i.test(rawName)) {
      const close = home.match(
        /SOLO NATIONALS[\s\S]{0,80}?CLOSING\s+(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+)/i,
      );
      const closeRange = close
        ? parseAussieDateRange(`${close[1]} ${close[2]} ${range.startDate.slice(0, 4)}`, 2026)
        : null;
      if (closeRange) registrationCloses = closeBeforeEvent(range.startDate, closeRange.startDate);
    }
    if (national && /troupe/i.test(rawName)) {
      const close = home.match(
        /TROUPE NATIONALS[\s\S]{0,80}?CLOSING\s+(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Za-z]+)/i,
      );
      const closeRange = close
        ? parseAussieDateRange(`${close[1]} ${close[2]} ${range.startDate.slice(0, 4)}`, 2026)
        : null;
      if (closeRange) registrationCloses = closeBeforeEvent(range.startDate, closeRange.startDate);
    }
    rows.push(
      baseComp({
        id: `dancelife-${slug(label)}-${range.startDate}`,
        name: `DanceLife Unite — ${label}`,
        kind: national ? "nationals" : "competition",
        organiser: "DanceLife Unite",
        organiserUrl: source.url,
        venue: national && !place ? "TBC" : place?.suburb || "TBC",
        suburb: place?.suburb || "TBC",
        state: place?.state || "NSW",
        startDate: range.startDate,
        endDate: range.endDate,
        registrationCloses,
        registrationUrl: performer,
        infoUrl: source.scrapeUrl,
        styles: YOUTH_STYLES,
        isNational: national,
        sourceId: source.id,
        notes: national && !place
          ? "Dates from the DanceLife Unite MyCompHQ event index. The index does not list a city for this national — confirm the venue on dancelifeunite.com.au before you travel."
          : "Dates and performer registration from dancelifeunite.mycomphq.com.au. Confirm on the organiser site before you enter.",
      }),
    );
  });
  return rows;
}

export function parseTalentTribeHtml(html: string, source: CompSource): Competition[] {
  const lines = htmlLines(html);
  const rows: Competition[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const range = parseAussieDateRange(lines[i], 2027);
    if (!range) continue;
    const window = lines.slice(Math.max(0, i - 3), i + 4).join(" ");
    if (!/national finals/i.test(window)) continue;
    if (!/governors centre|moore park/i.test(window)) continue;
    rows.push(
      baseComp({
        id: `talent-tribe-nationals-${range.startDate.slice(0, 4)}`,
        name: "Talent Tribe — National Finals",
        kind: "nationals",
        organiser: "Talent Tribe",
        organiserUrl: source.url,
        venue: "The Governors Centre",
        suburb: "Moore Park",
        state: "NSW",
        startDate: range.startDate,
        endDate: range.endDate,
        registrationUrl: "https://www.talenttribe.com.au/202627-national-tour",
        infoUrl: source.url,
        styles: YOUTH_STYLES,
        isNational: true,
        sourceId: source.id,
        notes:
          "National finals save-the-date from talenttribe.com.au. Regional tour cards on the 2026/27 tour page publish entry-close dates without a performance date or venue, so those stops are not listed until the organiser publishes them.",
      }),
    );
  }
  const byId = new Map<string, Competition>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

export function parseJumpPages(
  nationalsHtml: string,
  heatsHtml: string,
  source: CompSource,
): Competition[] {
  const text = normaliseTicketDates(htmlLines(nationalsHtml).join(" "));
  const sentence = text.match(
    /(\d{1,2}(?:st|nd|rd|th)?\s*-\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})/i,
  );
  const range = sentence ? parseAussieDateRange(sentence[1], 2026) : null;
  if (!range || !/gold coast/i.test(text)) return [];
  const dreamCentre = /dream centre,?\s*carrara/i.test(text);
  const registration =
    heatsHtml.match(
      /https?:\/\/jump-dance-challenge-nationals[^"'\s<]+/i,
    )?.[0] || "https://jump-dance-challenge-nationals-2026.compadminpro.com/";
  return [
    baseComp({
      id: `jump-nationals-${range.startDate.slice(0, 4)}`,
      name: "Jump Dance Challenge — National Championships",
      kind: "nationals",
      organiser: "Jump Dance Challenge",
      organiserUrl: source.url,
      venue: dreamCentre ? "Dream Centre" : "Gold Coast",
      suburb: dreamCentre ? "Carrara" : "Gold Coast",
      state: "QLD",
      startDate: range.startDate,
      endDate: range.endDate,
      registrationUrl: registration.replace(/\/$/, "") + "/",
      infoUrl: source.scrapeUrl,
      styles: YOUTH_STYLES,
      isNational: true,
      sourceId: source.id,
      notes: dreamCentre
        ? "Championship dates from jumpdancechallenge.com.au/natioanls. The same page lists the 2026 lineup at Dream Centre, Carrara. 2027 heat dates are image tiles without text dates, so those heats are not listed until the organiser publishes them as text."
        : "Championship dates from jumpdancechallenge.com.au/natioanls. Confirm the venue on the organiser site before you travel.",
    }),
  ];
}

export function parseTimeToShineHtml(html: string, source: CompSource): Competition[] {
  const $ = load(html);
  const rows: Competition[] = [];
  $("table.competition_list").each((_, table) => {
    const links = $(table)
      .find("a.competiton_link")
      .map((__, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get();
    const name = links[0] || "";
    const venueLine = links[1] || "";
    const startText = $(table).find("[id*=LabelHeldDateFrom]").first().text();
    const endText = $(table).find("[id*=LabelHeldDateTo]").first().text();
    const closeText = $(table).find("[id*=LabelCutoffDate]").first().text();
    const start = parseAussieDateRange(startText, 2026);
    const end = parseAussieDateRange(endText, 2026);
    const close = parseAussieDateRange(closeText, 2026);
    if (!name || !start || !end) return;
    const place = placeFrom(`${name} ${venueLine}`);
    if (!place) return;
    const division = /troupe/i.test(name)
      ? "Troupes"
      : /solo/i.test(name)
        ? "Solos"
        : "Competition";
    const venueName = venueLine.split(",")[0]?.trim() || place.suburb;
    rows.push(
      baseComp({
        id: `time-to-shine-${slug(place.suburb)}-${slug(division)}-${start.startDate}`,
        name: `Time to Shine — ${place.suburb} ${division}`,
        organiser: "Time to Shine",
        organiserUrl: "https://www.ttsdc.com.au",
        venue: venueName,
        suburb: place.suburb,
        state: place.state,
        startDate: start.startDate,
        endDate: end.startDate,
        registrationCloses: close ? endOfDay(close.startDate) : null,
        registrationUrl: source.scrapeUrl,
        infoUrl: "https://www.ttsdc.com.au/enter-here/",
        styles: YOUTH_STYLES,
        sourceId: source.id,
        notes:
          "Dates and entry close from the Time to Shine Comps-Online registration list. Confirm on the organiser site before you enter.",
      }),
    );
  });
  return rows;
}

/** Text dates only. The 2026 calendar on the events page is an image, so this often returns nothing. */
export function parseRaiseTheBarreHtml(html: string, source: CompSource): Competition[] {
  const rows: Competition[] = [];
  for (const line of htmlLines(html)) {
    if (!/perth|adelaide/i.test(line)) continue;
    const range = parseAussieDateRange(line, 2026);
    if (!range) continue;
    const place = placeFrom(line);
    if (!place) continue;
    const label = /adelaide/i.test(line) ? "Adelaide" : /perth\s*3/i.test(line) ? "Perth 3" : /perth\s*2/i.test(line) ? "Perth 2" : /perth\s*1/i.test(line) ? "Perth 1" : place.suburb;
    rows.push(
      baseComp({
        id: `raise-the-barre-${slug(label)}-${range.startDate.slice(0, 4)}`,
        name: `Raise the Barre — ${label}`,
        organiser: "Raise the Barre",
        organiserUrl: source.url,
        venue: place.suburb,
        suburb: place.suburb,
        state: place.state,
        startDate: range.startDate,
        endDate: range.endDate,
        registrationUrl: "https://www.raisethebarre.com.au/register/",
        infoUrl: source.scrapeUrl,
        styles: YOUTH_STYLES,
        sourceId: source.id,
        notes: "Dates read from text on raisethebarre.com.au/events/. Confirm on the organiser site before you enter.",
      }),
    );
  }
  return rows;
}
