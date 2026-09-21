import { unstable_cache, revalidateTag } from "next/cache";
import compsJson from "@/data/comps.json";
import sourcesJson from "@/data/sources.json";
import statusJson from "@/data/scrape-status.json";
import { scrapeAll, type ScrapeStatus } from "./scrape";
import type { CompSource, Competition } from "./types";

export const LIVE_COMPS_TAG = "live-comps";

const seedComps = compsJson as Competition[];
const sources = sourcesJson as CompSource[];

export function getSeedComps(): Competition[] {
  return seedComps;
}

export function getSeedStatus(): ScrapeStatus {
  return statusJson as ScrapeStatus;
}

async function computeLiveComps() {
  return scrapeAll(getSeedComps(), sources);
}

export const getCachedLiveComps = unstable_cache(
  computeLiveComps,
  ["live-comps-v1"],
  { revalidate: 86_400, tags: [LIVE_COMPS_TAG] },
);

export async function refreshLiveComps() {
  revalidateTag(LIVE_COMPS_TAG, { expire: 0 });
  return getCachedLiveComps();
}

export async function loadComps(): Promise<{
  comps: Competition[];
  status: ScrapeStatus;
  live: boolean;
}> {
  try {
    const livePromise = getCachedLiveComps().then((result) => ({
      ...result,
      live: true as const,
    }));
    const timeout = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), 1500);
    });
    const winner = await Promise.race([livePromise, timeout]);
    if (winner !== "timeout") return winner;
  } catch (error) {
    console.error("Live scrape unavailable, using seed listings", error);
  }
  return {
    comps: getSeedComps(),
    status: getSeedStatus(),
    live: false,
  };
}
