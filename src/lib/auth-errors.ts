export function friendlyAuthError(
  error: { message?: string } | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) {
    return "That email or password is not right.";
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "That email already has an account. Try logging in.";
  }
  if (
    lower.includes("profiles_username") ||
    (lower.includes("duplicate") && lower.includes("username"))
  ) {
    return "That username is taken. Try another.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email from the link we sent, then log in.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (
    lower.includes("unable to validate email") ||
    lower.includes("invalid email")
  ) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("password should be at least")) {
    return "Password needs to be at least 6 characters.";
  }
  if (lower.includes("signup is disabled")) {
    return "New accounts are paused. You can still use the app as a guest.";
  }
  if (
    lower.includes("profiles_role_check") ||
    (lower.includes("role") && lower.includes("check constraint"))
  ) {
    return "Studio sign-up is not switched on yet. Run the studio accounts SQL in Supabase, then try again.";
  }
  if (lower.includes("same password")) {
    return "Choose a new password that is different from the current one.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message;
}
