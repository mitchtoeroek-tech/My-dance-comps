import { COMMUNITY_GUIDELINES } from "@/lib/community";

/** Compact note for studio chats and friend threads. Does not block sending. */
export function CommunityGuidelines() {
  return (
    <p className="mt-2 rounded-card bg-surface px-3 py-2 text-sm leading-5 text-muted-foreground ring-1 ring-primary/30">
      {COMMUNITY_GUIDELINES}
    </p>
  );
}
