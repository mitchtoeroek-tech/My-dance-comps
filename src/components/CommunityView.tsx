"use client";

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { GuestCommunityUnlock } from "@/components/GuestCommunityUnlock";
import { useCommunityInbox } from "@/hooks/useCommunity";
import {
  communityMessagePreview,
  communityThreadPath,
  formatCommunityTime,
} from "@/lib/community";
import { myDancersLabel } from "@/lib/copy";

export function CommunityView() {
  const inbox = useCommunityInbox();
  const { view, conversations, incomingCount, error, childrenCount, firstChildId } =
    inbox;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Friends-only chat. Open a thread to message the other parent — you
          will see their dancer’s name, not their email.
        </p>
      </div>

      {view === "guest" || view === "unavailable" ? (
        <GuestCommunityUnlock nextPath="/community" />
      ) : null}

      {view === "loading" ? (
        <p className="text-sm font-semibold text-muted-foreground">
          Loading conversations…
        </p>
      ) : null}

      {view === "error" ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}

      {view === "ready" && incomingCount > 0 && firstChildId ? (
        <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold">
          {incomingCount === 1
            ? "1 friend request is waiting."
            : `${incomingCount} friend requests are waiting.`}{" "}
          Accept on{" "}
          <Link href={`/kids/${firstChildId}`} className="underline">
            {myDancersLabel(childrenCount)}
          </Link>{" "}
          before you can chat.
        </p>
      ) : null}

      {view === "ready" && childrenCount === 0 ? (
        <EmptyState
          title="Add a dancer first"
          body="Community chat is for accepted friends of your dancers. Add a profile, then add a friend from My Comps or My Dancers."
          action={
            <Link
              href="/kids"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Add a dancer
            </Link>
          }
        />
      ) : null}

      {view === "ready" && childrenCount > 0 && conversations.length === 0 ? (
        <EmptyState
          title="No friend chats yet"
          body="Add a friend from My Comps or My Dancers. Once they accept, the conversation shows up here."
          action={
            <Link
              href="/my-comps"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Add friends on My Comps
            </Link>
          }
        />
      ) : null}

      {view === "ready" && conversations.length > 0 ? (
        <ul className="space-y-2">
          {conversations.map((row) => {
            const preview = row.lastMessage
              ? communityMessagePreview(row.lastMessage.body)
              : "No messages yet — say hello.";
            const when = row.lastMessage
              ? formatCommunityTime(row.lastMessage.createdAt)
              : "";
            return (
              <li key={row.friendshipId}>
                <Link
                  href={communityThreadPath(row.friendshipId)}
                  className="block rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-bold text-foreground">
                      {row.friendName}
                    </p>
                    {when ? (
                      <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {when}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-primary-ink">
                    Friend of {row.ownChildName}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {preview}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
