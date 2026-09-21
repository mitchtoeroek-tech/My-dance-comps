import { CommunityThread } from "@/components/CommunityThread";

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ friendshipId: string }>;
}) {
  const { friendshipId } = await params;
  return <CommunityThread friendshipId={friendshipId} />;
}
