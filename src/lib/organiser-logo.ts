export type OrganiserMark =
  | { kind: "image"; src: string; label: string }
  | { kind: "monogram"; initials: string; label: string; tone: number };

const LOGOS = {
  sasds: { src: "/organisers/sasds.png", label: "SASDS" },
  "full-out": { src: "/organisers/full-out.png", label: "Full Out" },
  cmidc: { src: "/organisers/cmidc.png", label: "Count Me In" },
  evolution: { src: "/organisers/evolution.png", label: "Evolution" },
  carnival: { src: "/organisers/carnival.png", label: "Carnival" },
  rad: { src: "/organisers/rad.png", label: "Royal Academy of Dance" },
  cecchetti: { src: "/organisers/cecchetti.png", label: "Cecchetti" },
  "south-street": {
    src: "/organisers/south-street.png",
    label: "Royal South Street",
  },
  "gold-coast": {
    src: "/organisers/gold-coast.png",
    label: "Gold Coast Eisteddfod",
  },
  "light-up": { src: "/organisers/light-up.png", label: "Light Up the Stage" },
} as const;

type LogoId = keyof typeof LOGOS;

/** Organiser-name match wins over source, so Dance Hub rows keep the real brand. */
const NAME_RULES: { id: LogoId; test: (name: string) => boolean }[] = [
  { id: "full-out", test: (name) => name.includes("full out") },
  { id: "evolution", test: (name) => name.includes("evolution") },
  {
    id: "cmidc",
    test: (name) => name.includes("count me in") || name.includes("cmidc"),
  },
  { id: "carnival", test: (name) => name.includes("carnival") },
  {
    id: "sasds",
    test: (name) => name.includes("sasds") || name.includes("state dance sport"),
  },
  { id: "cecchetti", test: (name) => name.includes("cecchetti") },
  { id: "rad", test: (name) => name.includes("royal academy") },
  { id: "south-street", test: (name) => name.includes("south street") },
  {
    id: "gold-coast",
    test: (name) => name.includes("gold coast eisteddfod"),
  },
  { id: "light-up", test: (name) => name.includes("light up the stage") },
];

/** Sources that are the organiser. Aggregators stay on the name match or a monogram. */
const SOURCE_LOGOS: Record<string, LogoId> = {
  sasds: "sasds",
  "full-out": "full-out",
  cmidc: "cmidc",
  evolution: "evolution",
  carnival: "carnival",
};

const SKIP_WORDS = new Set(["the", "of", "and", "a", "an", "for"]);

export const MONOGRAM_TONE_COUNT = 4;

export function normaliseOrganiserName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[–—-].*$/, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function organiserInitials(name: string): string {
  const words = normaliseOrganiserName(name).split(" ").filter(Boolean);
  const significant = words.filter((word) => !SKIP_WORDS.has(word));
  const chosen = significant.length > 0 ? significant : words;
  if (chosen.length === 0) return "";
  if (chosen.length === 1) return chosen[0].slice(0, 2).toUpperCase();
  return chosen
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function monogramTone(label: string): number {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % MONOGRAM_TONE_COUNT;
}

function isPlaceholderName(name: string): boolean {
  const normalised = normaliseOrganiserName(name);
  return normalised === "" || normalised === "see source";
}

function imageMark(id: LogoId, label: string): OrganiserMark {
  const logo = LOGOS[id];
  return { kind: "image", src: logo.src, label: label || logo.label };
}

export function organiserMark(input: {
  sourceId?: string | null;
  organiser?: string | null;
}): OrganiserMark | null {
  const organiser = (input.organiser ?? "").trim();
  const sourceId = (input.sourceId ?? "").trim();
  const normalised = isPlaceholderName(organiser)
    ? ""
    : normaliseOrganiserName(organiser);

  if (normalised) {
    const rule = NAME_RULES.find((item) => item.test(normalised));
    if (rule) return imageMark(rule.id, organiser);
  }

  const sourceLogo = SOURCE_LOGOS[sourceId];
  if (sourceLogo) return imageMark(sourceLogo, organiser);

  const initials = organiserInitials(normalised);
  if (!initials) return null;
  return {
    kind: "monogram",
    initials,
    label: organiser,
    tone: monogramTone(organiser),
  };
}
