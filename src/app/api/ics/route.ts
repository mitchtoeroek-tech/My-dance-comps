import { NextRequest } from "next/server";
import { getComp } from "@/lib/comps";
import { loadComps } from "@/lib/live-comps";
import { competitionToIcs, remindersToIcs } from "@/lib/ics";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { comps } = await loadComps();
  const compId = searchParams.get("compId");
  if (!compId) {
    // Reminder calendars are built on the device from dancer styles.
    return new Response(remindersToIcs([]), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="dance-comp-reminders.ics"`,
      },
    });
  }

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
