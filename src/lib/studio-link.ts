import type { AccountRole } from "./account";
import type { ChildProfile } from "./types";

export interface StudioLinkTarget {
  id: string;
  name: string;
}

export type StudioLinkPlan =
  | { kind: "guest" }
  | { kind: "studio" }
  | { kind: "needs-profile"; role: "parent" | "dancer" }
  | { kind: "link"; dancers: ChildProfile[] };

/** Who can link from a public studio page, and which dancer profiles are in play. */
export function planStudioLink(input: {
  signedIn: boolean;
  role: AccountRole | null | undefined;
  children: readonly ChildProfile[];
  linkedChildId?: string | null;
  selectedChildId?: string | null;
}): StudioLinkPlan {
  if (!input.signedIn) return { kind: "guest" };
  if (input.role === "studio") return { kind: "studio" };
  const role = input.role === "dancer" ? "dancer" : "parent";
  const dancers = dancersEligibleToLink(
    input.children,
    role,
    input.linkedChildId ?? null,
    input.selectedChildId ?? null,
  );
  if (dancers.length === 0) return { kind: "needs-profile", role };
  return { kind: "link", dancers };
}

/**
 * Parents can link any dancer in the family.
 * A dancer login can link only their own profile.
 */
export function dancersEligibleToLink(
  children: readonly ChildProfile[],
  role: "parent" | "dancer",
  linkedChildId: string | null,
  selectedChildId: string | null,
): ChildProfile[] {
  const list = [...children];
  if (role !== "dancer") return list;
  if (linkedChildId) {
    const linked = list.find((child) => child.id === linkedChildId);
    return linked ? [linked] : [];
  }
  const selected = selectedChildId
    ? list.find((child) => child.id === selectedChildId)
    : undefined;
  const own = selected ?? list[0];
  return own ? [own] : [];
}

export function withStudioLink(
  child: ChildProfile,
  studio: StudioLinkTarget,
): ChildProfile {
  const name = studio.name.trim();
  return {
    ...child,
    studioId: studio.id,
    studio: name || child.studio,
  };
}

/** Drops the approved-studio link and keeps the display name. */
export function withoutStudioLink(
  child: ChildProfile,
  studioId: string,
): ChildProfile {
  if (child.studioId !== studioId) return child;
  return { ...child, studioId: null };
}

export function isLinkedToStudio(child: ChildProfile, studioId: string): boolean {
  return child.studioId === studioId;
}

/** Inline confirmation. Includes the dancer name when a parent has more than one. */
export function studioLinkedLabel(studioName: string, dancerName?: string): string {
  const studio = studioName.trim() || "this studio";
  const dancer = dancerName?.trim();
  if (dancer) return `${dancer} — Linked to ${studio}.`;
  return `Linked to ${studio}.`;
}
