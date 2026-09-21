import { loadComps } from "@/lib/live-comps";
import { registrationStatus } from "@/lib/comps";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { comps } = await loadComps();
  const comp = comps.find((item) => item.id === id);
  if (!comp) {
    return Response.json({ error: "Competition not found" }, { status: 404 });
  }
  return Response.json({
    ...comp,
    registrationStatus: registrationStatus(comp),
  });
}
