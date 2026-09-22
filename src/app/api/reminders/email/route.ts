import { NextRequest } from "next/server";
import {
  accountEmailFromAccessToken,
  isReminderEmailConfigured,
  parseReminderDigestItems,
  sendReminderDigest,
} from "@/lib/reminder-email";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ configured: isReminderEmailConfigured() });
}

export async function POST(request: NextRequest) {
  if (!isReminderEmailConfigured()) {
    return Response.json({
      configured: false,
      sent: false,
      reason: "not_configured",
    });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const email = token ? await accountEmailFromAccessToken(token) : null;
  if (!email) {
    return Response.json(
      { configured: true, sent: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const items = parseReminderDigestItems(body?.items);
  const result = await sendReminderDigest({ to: email, items });
  return Response.json(result, { status: result.sent ? 200 : 502 });
}
