import { NextRequest } from "next/server";
import { getComp, getComps } from "@/lib/comps";
import { competitionToIcs, remindersToIcs } from "@/lib/ics";
import { buildReminders, upcomingReminders } from "@/lib/reminders";
import { defaultReminderPrefs } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const compId = searchParams.get("compId");
  if (compId) {
    const comp = getComp(compId);
    if (!comp) {
      return Response.json({ error: "Competition not found" }, { status: 404 });
    }
    return new Response(competitionToIcs(comp), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${comp.id}.ics"`,
      },
    });
  }

  const saved = (searchParams.get("saved") ?? "").split(",").filter(Boolean);
  const items = upcomingReminders(
    buildReminders(getComps(), defaultReminderPrefs, saved),
  );
  return new Response(remindersToIcs(items), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="dance-comp-reminders.ics"`,
    },
  });
}
