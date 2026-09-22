/** Parent-facing tab/page name for dancer profiles. */
export function myDancersLabel(count: number): "My Dancer" | "My Dancers" {
  return count === 1 ? "My Dancer" : "My Dancers";
}

/** Dancer-facing name for their own /kids tab and page. */
export const MY_INFO_LABEL = "My Info" as const;

/**
 * Section name for /kids. A dancer login always sees My Info.
 * Guests, parents, and studios keep My Dancer / My Dancers by count.
 */
export function kidsSectionLabel(
  role: string | null | undefined,
  count: number,
): typeof MY_INFO_LABEL | "My Dancer" | "My Dancers" {
  return role === "dancer" ? MY_INFO_LABEL : myDancersLabel(count);
}
