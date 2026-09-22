/** Confirm copy for a parent leaving a shared family. The database enforces the same rule. */
export function parentLeaveConfirmMessage(
  otherParentCount: number,
  linkedDancerCount: number,
): string {
  if (otherParentCount > 0) {
    return "Leave this family? The other parent keeps the dancers, enrolments and results. You will no longer see them on this login.";
  }
  if (linkedDancerCount > 0) {
    return "A dancer still has their own login in this family. Invite another parent, or remove those logins, before you leave. The family stays as it is.";
  }
  return "Leave this family? You are the only parent, so the family code will stop working. Your dancer profiles, enrolments and results stay on this account.";
}

export function parentListLabel(parent: {
  displayName: string;
  isYou: boolean;
}): string {
  return parent.isYou ? `${parent.displayName} (you)` : parent.displayName;
}
