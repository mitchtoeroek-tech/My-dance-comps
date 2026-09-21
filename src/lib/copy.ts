/** Parent-facing tab/page name for dancer profiles. */
export function myDancersLabel(count: number): "My Dancer" | "My Dancers" {
  return count === 1 ? "My Dancer" : "My Dancers";
}
