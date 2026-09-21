export const AU_STATES = [
  { code: "SA", name: "South Australia", short: "SA" },
  { code: "VIC", name: "Victoria", short: "Vic" },
  { code: "NSW", name: "New South Wales", short: "NSW" },
  { code: "QLD", name: "Queensland", short: "Qld" },
  { code: "WA", name: "Western Australia", short: "WA" },
  { code: "TAS", name: "Tasmania", short: "Tas" },
  { code: "NT", name: "Northern Territory", short: "NT" },
  { code: "ACT", name: "Australian Capital Territory", short: "ACT" },
] as const;

export type AuStateCode = (typeof AU_STATES)[number]["code"];

export const DANCE_STYLES = [
  "Ballet",
  "Jazz",
  "Tap",
  "Contemporary",
  "Lyrical",
  "Hip Hop",
  "Musical Theatre",
  "Broadway Jazz",
  "Acro",
  "Song and Dance",
  "Song and Tap",
  "Character",
  "National Character",
  "Funk",
] as const;

export type DanceStyle = (typeof DANCE_STYLES)[number];

export type CompKind = "competition" | "eisteddfod" | "nationals" | "showcase";

export interface Competition {
  id: string;
  name: string;
  kind: CompKind;
  organiser: string;
  organiserUrl: string;
  venue: string;
  suburb: string;
  state: AuStateCode;
  startDate: string;
  endDate: string;
  registrationOpens: string | null;
  registrationCloses: string | null;
  registrationUrl: string;
  infoUrl: string;
  styles: DanceStyle[];
  minAge: number | null;
  maxAge: number | null;
  isNational: boolean;
  notes: string;
  sourceId: string;
  lastUpdated: string;
}

export interface CompSource {
  id: string;
  name: string;
  url: string;
  scrapeUrl: string;
  parser: "sasds" | "evolution" | "cmidc" | "dance-hub-table" | "html-generic" | "seed-only";
  notes: string;
  region: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  dob: string;
  styles: DanceStyle[];
  studio: string;
  homeState: AuStateCode;
}

export interface CompResult {
  id: string;
  childId: string;
  compId: string | null;
  compName: string;
  date: string;
  section: string;
  placing: string;
  score: string;
  notes: string;
}

export interface ReminderPrefs {
  onOpen: boolean;
  weekBeforeClose: boolean;
  dayBeforeClose: boolean;
}

export type ReminderKind = "open" | "week-before-close" | "day-before-close";

export interface ReminderItem {
  id: string;
  kind: ReminderKind;
  compId: string;
  compName: string;
  fireAt: string;
  label: string;
  detail: string;
}

export interface FamilyState {
  version: 1;
  children: ChildProfile[];
  selectedChildId: string | null;
  favourites: string[];
  includeInterstate: boolean;
  reminderPrefs: ReminderPrefs;
  notifiedReminderIds: string[];
  results: CompResult[];
}

export type RegistrationStatus =
  | "opens-soon"
  | "open"
  | "closing-soon"
  | "closed"
  | "unknown";
