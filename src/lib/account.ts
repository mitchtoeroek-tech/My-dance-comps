export const DANCER_LOGIN_DOMAIN = "dancers.mydancecomps.app";

export type AccountRole = "parent" | "dancer" | "studio";

export interface AccountProfile {
  role: AccountRole;
  familyId: string | null;
  linkedChildId: string | null;
  displayName: string | null;
  username: string | null;
}

export function parseAccountRole(value: unknown): AccountRole {
  if (value === "dancer" || value === "studio") return value;
  return "parent";
}

/** Profile column wins once it is parent, dancer, or studio. Metadata covers a missing column. */
export function resolveAccountRole(
  profileRole: unknown,
  metadataRole: unknown,
): AccountRole {
  if (
    profileRole === "dancer" ||
    profileRole === "parent" ||
    profileRole === "studio"
  ) {
    return profileRole;
  }
  return parseAccountRole(metadataRole);
}

export function isDancerRole(role: AccountRole | null | undefined): boolean {
  return role === "dancer";
}

/** 3–24 characters, starts and ends with a letter or number. */
export function normalizeDancerUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])$/.test(username)) {
    if (!/^[a-z0-9]{3}$/.test(username)) return null;
    return username;
  }
  if (username.length < 3 || username.length > 24) return null;
  return username;
}

export function dancerLoginEmail(username: string): string {
  return `${username}@${DANCER_LOGIN_DOMAIN}`;
}

export function loginIdentifierToEmail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  const username = normalizeDancerUsername(trimmed);
  return username ? dancerLoginEmail(username) : trimmed;
}

export function displayFamilyCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  return normalized || code.trim().toUpperCase();
}

export function normalizeFamilyCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
