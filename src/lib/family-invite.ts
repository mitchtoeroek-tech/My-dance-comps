import { normalizeFamilyCode, type AccountRole } from "./account";
import { safeInternalPath } from "./friends";

export interface DancerInviteTarget {
  family: string;
  childId: string;
  role: AccountRole;
}

/** Shareable signup URL that prefills a dancer login for one profile. */
export function dancerInvitePath(code: string, childId: string): string {
  const params = new URLSearchParams({
    role: "dancer",
    family: normalizeFamilyCode(code),
    child: childId.trim(),
  });
  return `/signup?${params.toString()}`;
}

export function dancerInviteUrl(
  origin: string,
  code: string,
  childId: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${dancerInvitePath(code, childId)}`;
}

/** Shareable parent signup URL. Separate from the dancer family code. */
export function coparentSignupPath(code: string): string {
  const params = new URLSearchParams({
    role: "parent",
    coparent: normalizeFamilyCode(code),
  });
  return `/signup?${params.toString()}`;
}

export function coparentInviteUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${coparentSignupPath(code)}`;
}

/** Where a parent login accepts a co-parent invite. */
export function coparentJoinPath(code: string): string {
  const params = new URLSearchParams({
    coparent: normalizeFamilyCode(code),
  });
  return `/family/join?${params.toString()}`;
}

/** Reads a co-parent signup or login link. Dancer `family` codes are ignored. */
export function readCoparentInvite(search: string): { code: string } | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  let code = normalizeFamilyCode(params.get("coparent") ?? "");
  if (!code) {
    const next = safeInternalPath(params.get("next"));
    if (next?.includes("coparent=")) {
      const nested = next.includes("?") ? next.slice(next.indexOf("?")) : "";
      code = normalizeFamilyCode(new URLSearchParams(nested).get("coparent") ?? "");
    }
  }
  if (!code) return null;
  return { code };
}

/** Where a new or existing dancer login finishes joining the named profile. */
export function familyJoinPath(code: string, childId: string): string {
  const params = new URLSearchParams({
    family: normalizeFamilyCode(code),
  });
  const child = childId.trim();
  if (child) params.set("child", child);
  return `/family/join?${params.toString()}`;
}

/**
 * The named profile when it is still free.
 * A linked or unknown id stays unselected so a sibling is not taken by mistake.
 */
export function pickUnlinkedInviteChild(
  dancers: { id: string; linked: boolean }[],
  childId: string,
): string | null {
  const id = childId.trim();
  if (!id) return null;
  const match = dancers.find((dancer) => dancer.id === id);
  if (!match || match.linked) return null;
  return match.id;
}

function parseAccountRole(value: string | null): AccountRole | null {
  if (value === "dancer" || value === "parent" || value === "studio") {
    return value;
  }
  return null;
}

function readJoinQuery(search: string): { family: string; childId: string } {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return {
    family: normalizeFamilyCode(params.get("family") ?? ""),
    childId: (params.get("child") ?? "").trim(),
  };
}

/** Reads a signup link, or a login `next` that points at /family/join. */
export function readDancerInvite(search: string): DancerInviteTarget | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  let { family, childId } = readJoinQuery(raw);
  let role = parseAccountRole(params.get("role"));

  if (!family) {
    const next = safeInternalPath(params.get("next"));
    if (next?.startsWith("/family/join")) {
      const nested = next.includes("?") ? next.slice(next.indexOf("?")) : "";
      const inner = readJoinQuery(nested);
      family = inner.family;
      childId = childId || inner.childId;
      role = role ?? "dancer";
    }
  }

  if (!family) return null;
  return { family, childId, role: role ?? "dancer" };
}
