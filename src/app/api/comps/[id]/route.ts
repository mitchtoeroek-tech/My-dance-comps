import { getComp, registrationStatus } from "@/lib/comps";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const comp = getComp(id);
  if (!comp) {
    return Response.json({ error: "Competition not found" }, { status: 404 });
  }
  return Response.json({
    ...comp,
    registrationStatus: registrationStatus(comp),
  });
}
