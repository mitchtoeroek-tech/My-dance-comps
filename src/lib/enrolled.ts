/** Per-child confirmed entries. Missing keys fall back to the family-wide list. */
export type EnrolledByChild = Record<string, string[]>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeEnrolledByChild(
  raw: unknown,
  childIds: string[],
): EnrolledByChild {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(childIds);
  const out: EnrolledByChild = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    out[key] = asStringArray(value);
  }
  return out;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Comp ids marked Enrolled for one child, or the family union when
 * `childId` is null (All children / Everyone).
 *
 * A child without their own set still sees the legacy family-wide list
 * until they toggle Enrolled for the first time.
 */
export function enrolledIdsForChild(
  enrolled: string[],
  enrolledByChild: EnrolledByChild | undefined,
  childId: string | null,
): string[] {
  const family = Array.isArray(enrolled) ? enrolled : [];
  const byChild =
    enrolledByChild && typeof enrolledByChild === "object"
      ? enrolledByChild
      : {};

  if (childId) {
    if (Object.prototype.hasOwnProperty.call(byChild, childId)) {
      return uniqueIds(asStringArray(byChild[childId]));
    }
    return uniqueIds(family);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of family) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const ids of Object.values(byChild)) {
    for (const id of asStringArray(ids)) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function isCompEnrolled(
  enrolled: string[],
  enrolledByChild: EnrolledByChild | undefined,
  compId: string,
  childId: string | null,
): boolean {
  return enrolledIdsForChild(enrolled, enrolledByChild, childId).includes(
    compId,
  );
}

export function toggleEnrollment(
  enrolled: string[],
  enrolledByChild: EnrolledByChild | undefined,
  compId: string,
  childId: string | null,
): { enrolled: string[]; enrolledByChild: EnrolledByChild } {
  const family = Array.isArray(enrolled) ? enrolled : [];
  const byChild: EnrolledByChild = { ...(enrolledByChild ?? {}) };

  if (childId) {
    const current = Object.prototype.hasOwnProperty.call(byChild, childId)
      ? asStringArray(byChild[childId])
      : family;
    const has = current.includes(compId);
    byChild[childId] = has
      ? current.filter((id) => id !== compId)
      : [...current, compId];
    return { enrolled: family, enrolledByChild: byChild };
  }

  const union = enrolledIdsForChild(family, byChild, null);
  if (union.includes(compId)) {
    const nextByChild: EnrolledByChild = {};
    for (const [id, ids] of Object.entries(byChild)) {
      nextByChild[id] = asStringArray(ids).filter((item) => item !== compId);
    }
    return {
      enrolled: family.filter((id) => id !== compId),
      enrolledByChild: nextByChild,
    };
  }

  return {
    enrolled: [...family, compId],
    enrolledByChild: byChild,
  };
}

export function dropChildEnrollment(
  enrolledByChild: EnrolledByChild | undefined,
  childId: string,
): EnrolledByChild {
  if (!enrolledByChild || !Object.prototype.hasOwnProperty.call(enrolledByChild, childId)) {
    return enrolledByChild ?? {};
  }
  const next = { ...enrolledByChild };
  delete next[childId];
  return next;
}
