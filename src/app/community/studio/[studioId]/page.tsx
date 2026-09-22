import { StudioCommunityThread } from "@/components/StudioCommunityThread";

export default async function StudioCommunityPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const { studioId } = await params;
  return <StudioCommunityThread studioId={studioId} />;
}
