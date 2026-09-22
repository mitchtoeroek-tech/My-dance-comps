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
  /** ISO timestamp of the last successful organiser fetch for this row, if known. */
  lastFetchedAt?: string;
}

export interface CompSource {
  id: string;
  name: string;
  url: string;
  scrapeUrl: string;
  parser:
    | "sasds"
    | "evolution"
    | "cmidc"
    | "dance-hub-table"
    | "html-generic"
    | "full-out"
    | "seed-only";
  notes: string;
  region: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  dob: string;
  styles: DanceStyle[];
  studio: string;
  /** Approved studio account this dancer is linked to. Null when the name is typed only. */
  studioId?: string | null;
  homeState: AuStateCode;
  /** Set when this dancer has their own login linked by a parent. */
  linkedUserId?: string;
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

/** One review per user (or guest device) per competition. */
export const REVIEW_STARS = [1, 2, 3, 4, 5] as const;
export type ReviewStars = (typeof REVIEW_STARS)[number];

/**
 * Public review row. Guests store this in localStorage keyed by competitionId.
 * Once accounts ship, the same shape maps to Supabase `reviews`
 * (see supabase/migrations/20260921_reviews.sql).
 */
export interface CompReview {
  id: string;
  competitionId: string;
  /** Auth user id when logged in; null for the current guest device. */
  userId: string | null;
  /** Public name once accounts exist. Guests are shown as “You”. */
  displayName: string | null;
  stars: ReviewStars;
  /** Optional; empty string when the parent left no comment. */
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsState {
  version: 1;
  /** Guest MVP: at most one review per competition on this device. */
  byCompetitionId: Record<string, CompReview>;
}

/**
 * In-app reminder toggles. Email is a stored preference: the app only
 * sends mail when Resend is configured (see `reminder-email.ts`).
 * Close-date nudges (week before / day before) are no longer used.
 */
export interface ReminderPrefs {
  /** Primary: a matching comp appears in the listings after this device’s watermark. */
  newlyAnnounced: boolean;
  /** A matching comp’s registration opens, or its open date is reached. */
  onOpen: boolean;
  /** Also email the signed-in account. Stored even when server email is not connected. */
  emailEnabled: boolean;
}

export type ReminderKind = "newly-announced" | "open";

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
  /**
   * Family-wide confirmed entries (legacy + Everyone / All dancers).
   * Stored like favourites in localStorage and synced when signed in.
   */
  enrolled: string[];
  /**
   * Per-child confirmed entries. A missing key means that child still
   * uses `enrolled` until they toggle Enrolled for the first time.
   */
  enrolledByChild: Record<string, string[]>;
  includeInterstate: boolean;
  /** Last-used / preferred home state for the main Comps list. */
  preferredState: AuStateCode | null;
  reminderPrefs: ReminderPrefs;
  notifiedReminderIds: string[];
  results: CompResult[];
}

export function isAuStateCode(value: unknown): value is AuStateCode {
  return AU_STATES.some((state) => state.code === value);
}

export type RegistrationStatus =
  | "opens-soon"
  | "open"
  | "closing-soon"
  | "closed"
  | "unknown";
