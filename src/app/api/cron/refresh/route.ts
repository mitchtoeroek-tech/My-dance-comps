import { NextRequest } from "next/server";
import { refreshLiveComps } from "@/lib/live-comps";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { comps, status } = await refreshLiveComps();
    return Response.json({
      ok: true,
      count: comps.length,
      added: status.added,
      updated: status.updated,
      sources: status.sources,
      lastRunAt: status.lastRunAt,
    });
  } catch (error) {
    console.error("Daily scrape failed", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Scrape failed",
      },
      { status: 500 },
    );
  }
}
