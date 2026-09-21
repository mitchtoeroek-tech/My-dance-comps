import { NextRequest } from "next/server";
import { registrationStatus } from "@/lib/comps";
import { loadComps } from "@/lib/live-comps";
import { ADELAIDE_TZ, formatDateTime } from "@/lib/datetime";
import { filterComps } from "@/lib/filter";
import { ageAsAt1January } from "@/lib/age";
import { isAuStateCode, type ChildProfile, type DanceStyle } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? "";
  const includeInterstateParam = searchParams.get("interstate") === "1";
  const stateRaw = searchParams.get("state");
  const state = isAuStateCode(stateRaw) ? stateRaw : null;
  const styles = (searchParams.get("styles") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as DanceStyle[];
  const dob = searchParams.get("dob");
  const favouriteIds = (searchParams.get("saved") ?? "")
    .split(",")
    .filter(Boolean);

  const child: ChildProfile | null =
    dob && state
      ? {
          id: "query",
          name: "Filter",
          dob,
          styles,
          studio: "",
          homeState: state,
        }
      : null;

  const { comps: allComps, status, live } = await loadComps();
  const comps = filterComps(allComps, {
    query,
    // No state and no child: return the full catalogue (API dump). Home-state
    // filtering applies when `state` or child dob+state are provided.
    includeInterstate: child || state ? includeInterstateParam : true,
    child,
    homeState: state,
    onlyFavourites: favouriteIds.length > 0,
    favouriteIds,
  });

  return Response.json({
    timezone: ADELAIDE_TZ,
    count: comps.length,
    generatedAt: new Date().toISOString(),
    refreshedAt: status.lastRunAt,
    lastChecked: formatDateTime(status.lastRunAt),
    live,
    scrape: status.sources,
    comps: comps.map((comp) => ({
      ...comp,
      registrationStatus: registrationStatus(comp),
      ageAsAt1January: dob
        ? ageAsAt1January(dob, Number(comp.startDate?.slice(0, 4)))
        : null,
    })),
  });
}
