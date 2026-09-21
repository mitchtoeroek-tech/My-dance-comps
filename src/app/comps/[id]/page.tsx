import { notFound } from "next/navigation";
import { CompDetail } from "@/components/CompDetail";
import { getComp, getComps } from "@/lib/comps";

export function generateStaticParams() {
  return getComps().map((comp) => ({ id: comp.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const comp = getComp(id);
  return {
    title: comp?.name ?? "Competition",
  };
}

export default async function CompPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const comp = getComp(id);
  if (!comp) notFound();
  return <CompDetail comp={comp} />;
}
