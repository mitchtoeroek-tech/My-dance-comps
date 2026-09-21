import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeAll } from "../src/lib/scrape.ts";
import type { CompSource, Competition } from "../src/lib/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const compsPath = join(root, "src/data/comps.json");
const sourcesPath = join(root, "src/data/sources.json");
const statusPath = join(root, "src/data/scrape-status.json");

export async function runScrapeCli() {
  const sources = JSON.parse(readFileSync(sourcesPath, "utf8")) as CompSource[];
  const seed = JSON.parse(readFileSync(compsPath, "utf8")) as Competition[];
  const { comps, status } = await scrapeAll(seed, sources);
  writeFileSync(compsPath, `${JSON.stringify(comps, null, 2)}\n`);
  writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  console.log(status.sources.join("\n"));
  console.log(
    `\nWrote ${comps.length} comps (${status.added} added, ${status.updated} dates updated). Seed rows are never deleted.`,
  );
}

runScrapeCli().catch((error) => {
  console.error(error);
  process.exit(1);
});
