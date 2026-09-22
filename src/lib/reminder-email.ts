import { createClient } from "@supabase/supabase-js";
import { ADELAIDE_TZ } from "./datetime";
import type { ReminderItem, ReminderKind } from "./types";

/**
 * Server email needs a Resend API key and a from-address on a verified domain.
 * Without both, nothing is sent. The Reminders page stores `emailEnabled`
 * and opens a mailto draft instead.
 */
export function reminderEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.REMINDER_EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from.includes("@")) return null;
  return { apiKey, from };
}

export function isReminderEmailConfigured(): boolean {
  return reminderEmailConfig() !== null;
}

export type ReminderEmailResult =
  | { configured: false; sent: false; reason: "not_configured" }
  | { configured: true; sent: true }
  | { configured: true; sent: false; reason: string };

function isKind(value: unknown): value is ReminderKind {
  return value === "newly-announced" || value === "open";
}

export function parseReminderDigestItems(value: unknown): ReminderItem[] {
  if (!Array.isArray(value)) return [];
  const items: ReminderItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (!isKind(row.kind) || typeof row.id !== "string" || typeof row.label !== "string") {
      continue;
    }
    items.push({
      id: row.id,
      kind: row.kind,
      compId: typeof row.compId === "string" ? row.compId : "",
      compName: typeof row.compName === "string" ? row.compName : "",
      fireAt: typeof row.fireAt === "string" ? row.fireAt : "",
      label: row.label,
      detail: typeof row.detail === "string" ? row.detail : "",
    });
  }
  return items.slice(0, 30);
}

export function reminderDigestText(items: ReminderItem[]): string {
  const lines = [
    "Reminders from My Dance Comps.",
    "Only competitions that match your dancers’ styles.",
    "Times are Australia/Adelaide.",
    "",
  ];
  for (const item of items) {
    const when = item.fireAt
      ? new Date(item.fireAt).toLocaleString("en-AU", {
          timeZone: ADELAIDE_TZ,
          dateStyle: "full",
          timeStyle: "short",
        })
      : "Date to be confirmed";
    lines.push(`• ${item.label}`, `  ${when}`, `  ${item.detail}`, "");
  }
  return lines.join("\n").trim();
}

export async function sendReminderDigest(opts: {
  to: string;
  items: ReminderItem[];
  fetchImpl?: typeof fetch;
}): Promise<ReminderEmailResult> {
  const config = reminderEmailConfig();
  if (!config) return { configured: false, sent: false, reason: "not_configured" };
  const to = opts.to.trim();
  if (!to.includes("@")) {
    return { configured: true, sent: false, reason: "missing_address" };
  }
  if (opts.items.length === 0) {
    return { configured: true, sent: false, reason: "empty" };
  }
  const response = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: "Dance competition reminders",
      text: reminderDigestText(opts.items),
    }),
  });
  if (!response.ok) {
    return { configured: true, sent: false, reason: "provider_error" };
  }
  return { configured: true, sent: true };
}

/** Account email for the signed-in Supabase session. Never trusts a client-supplied address. */
export async function accountEmailFromAccessToken(
  token: string,
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!token || !url.startsWith("http") || key.length < 20) return null;
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return data.user.email;
}
