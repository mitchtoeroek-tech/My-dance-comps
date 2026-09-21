import { getSources } from "@/lib/comps";

export async function GET() {
  return Response.json({ sources: getSources() });
}
