import { NextRequest } from "next/server";
import { getComp, getComps } from "@/lib/comps";
import { loadComps } from "@/lib/live-comps";
import { competitionToIcs, remindersToIcs } from "@/lib/ics";
import { buildReminders, upcomingReminders } from "@/lib/reminders";
import { defaultReminderPrefs } from "@/lib/storage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { comps } = await loadComps();
  const compId = searchParams.get("compId");
  if (compId) {
    const comp = comps.find((item) => item.id === compId) ?? getComp(compId);
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
    buildReminders(comps.length ? comps : getComps(), defaultReminderPrefs, saved),
  );
  return new Response(remindersToIcs(items), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="dance-comp-reminders.ics"`,
    },
  });
}
