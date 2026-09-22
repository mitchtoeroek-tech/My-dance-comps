/**
 * Studio chat names. The database function studio_chat_sender_label is the
 * source of truth on send. Keep these rules in step with
 * supabase/migrations/20260923_chat_sender_labels.sql.
 *
 * Friend direct messages do not store a sender_label. They are a private
 * thread between two accounts, so the bubble side is the only speaker cue.
 */

export interface ChatLabelChild {
  name: string;
  studio?: string | null;
}

export interface StudioChatLabelInput {
  role: "parent" | "dancer" | "studio" | null | undefined;
  displayName?: string | null;
  /** Linked child, or the dancer’s own profile name. */
  dancerName?: string | null;
  childNames?: readonly string[];
  studioName?: string | null;
  /** Linked to a child profile even when profiles.role was stored as parent. */
  linkedDancer?: boolean;
}

export function collapseChatName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** First token. Emails and blanks become "". */
export function chatFirstName(raw: string | null | undefined): string {
  const clean = collapseChatName(raw);
  if (!clean || clean.includes("@")) return "";
  return clean.split(" ")[0] ?? "";
}

/**
 * Dancer chat name: first name, plus the initial of the surname.
 * One token stays as that first name. "Mitch Test" → "Mitch T". "Mitch" → "Mitch".
 */
export function dancerChatLabel(raw: string | null | undefined): string | null {
  const clean = collapseChatName(raw);
  if (!clean || clean.includes("@")) return null;
  const parts = clean.split(" ");
  const first = parts[0] ?? "";
  if (!first) return null;
  if (parts.length === 1) return first.slice(0, 80);
  const surname = parts[parts.length - 1] ?? "";
  const initial = surname.charAt(0).toUpperCase();
  if (!initial) return first.slice(0, 80);
  return `${first} ${initial}`.slice(0, 80);
}

/** "Evie", "Evie and Harriet", or "Evie, Harriet and Mia". Sorted en-AU. */
export function joinChatNames(names: readonly string[]): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b, "en-AU"));
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  const head = unique.slice(0, -1).join(", ");
  return `${head} and ${unique[unique.length - 1]}`;
}

/**
 * Parent chat name. Empty parent name falls back to Parent.
 * Children contribute first names only.
 */
export function parentChatLabel(
  parentName: string | null | undefined,
  childFullNames: readonly string[],
): string {
  const parent = chatFirstName(parentName) || "Parent";
  const kids = joinChatNames(
    childFullNames.map((name) => chatFirstName(name)).filter(Boolean),
  );
  if (!kids) return parent.slice(0, 80);
  return `${parent}, parent of ${kids}`.slice(0, 160);
}

/**
 * Value stored on profiles.display_name.
 * Blank is allowed on Account (chat falls back to Parent). An email is refused.
 */
export function normalizeChatDisplayName(raw: string): string | null {
  const clean = collapseChatName(raw);
  if (!clean) return "";
  if (clean.includes("@")) return null;
  return clean.slice(0, 80);
}

/** New parent sign-up must store a name. A first name is enough. */
export function parentSignupName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeChatDisplayName(raw);
  if (name === null) {
    return {
      ok: false,
      error: "Use your name. Email addresses are hidden in chat.",
    };
  }
  if (!name) {
    return {
      ok: false,
      error: "Add your name so studio chat can show who is writing.",
    };
  }
  return { ok: true, name };
}

export function studioChatSenderLabel(input: StudioChatLabelInput): string {
  if (input.role === "studio") {
    const studio = collapseChatName(input.studioName);
    if (studio && !studio.includes("@")) return studio.slice(0, 80);
    return "Studio";
  }

  const dancer = input.role === "dancer" || input.linkedDancer === true;
  if (dancer) {
    return (
      dancerChatLabel(input.dancerName) ??
      dancerChatLabel(input.displayName) ??
      "Dancer"
    );
  }

  return parentChatLabel(input.displayName, input.childNames ?? []);
}

/** One preview line per studio, so a parent sees the label each room will use. */
export function parentStudioChatLines(
  parentName: string | null | undefined,
  children: readonly ChatLabelChild[],
): { studio: string | null; label: string }[] {
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (const child of children) {
    const studio = collapseChatName(child.studio);
    if (!groups.has(studio)) {
      groups.set(studio, []);
      order.push(studio);
    }
    groups.get(studio)?.push(child.name);
  }
  if (order.length === 0) {
    return [{ studio: null, label: parentChatLabel(parentName, []) }];
  }
  return order.map((studio) => ({
    studio: studio || null,
    label: parentChatLabel(parentName, groups.get(studio) ?? []),
  }));
}
