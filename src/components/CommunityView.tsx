"use client";

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { GuestCommunityUnlock } from "@/components/GuestCommunityUnlock";
import { StudioChatMark } from "@/components/StudioChatMark";
import { useAuth } from "@/context/AuthContext";
import { useCommunityInbox } from "@/hooks/useCommunity";
import { useStudioChats } from "@/hooks/useStudioCommunity";
import {
  communityMessagePreview,
  communityThreadPath,
  formatCommunityTime,
} from "@/lib/community";
import { NO_STUDIO_FRIENDS_COPY } from "@/lib/friends";
import {
  STUDIO_CHAT_EMPTY_BODY,
  studioChatListPreview,
  studioChatLogoUrl,
  studioCommunityThreadPath,
} from "@/lib/studio-community";

const NO_STUDIO_FRIENDS_BODY = `${NO_STUDIO_FRIENDS_COPY}. Friend chat is only for accepted friends at that studio.`;

export function CommunityView() {
  const { account } = useAuth();
  const inbox = useCommunityInbox();
  const studios = useStudioChats();
  const dancer = account?.role === "dancer";
  const { view, conversations, incomingCount, error, hasStudio, role } = inbox;

  if (
    view === "guest" ||
    view === "unavailable" ||
    studios.view === "guest" ||
    studios.view === "unavailable"
  ) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Studio chat for families linked to an approved studio, and friends
            chat with accepted friends.
          </p>
        </header>
        <GuestCommunityUnlock nextPath="/community" />
      </div>
    );
  }

  if (view === "loading" && studios.view === "loading") {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Studio chat for your studio, and friends chat with accepted friends.
            You will see dancer names, not emails.
          </p>
        </header>
        <p className="text-sm font-semibold text-muted-foreground">
          Loading community…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Studio chat for your studio, and friends chat with accepted friends.
          You will see dancer names, not emails.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="studio-chats-heading">
        <h2 id="studio-chats-heading" className="text-lg font-bold">
          Studio chats
        </h2>
        {studios.view === "loading" ? (
          <p className="text-sm font-semibold text-muted-foreground">
            Loading studio chats…
          </p>
        ) : null}
        {studios.view === "error" ? (
          <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
            {studios.error}
          </p>
        ) : null}
        {studios.view === "ready" && studios.chats.length === 0 ? (
          <EmptyState
            title={
              studios.role === "studio"
                ? "Studio chat is not open yet"
                : "No studio chats yet"
            }
            body={
              studios.role === "studio"
                ? "Your studio chat opens once the studio is approved. Pending and rejected studios do not have an open chat."
                : STUDIO_CHAT_EMPTY_BODY
            }
            action={
              studios.role === "studio" ? undefined : (
                <Link
                  href="/studios"
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  Browse studios
                </Link>
              )
            }
          />
        ) : null}
        {studios.view === "ready" && studios.chats.length > 0 ? (
          <ul className="space-y-2">
            {studios.chats.map((chat) => {
              const when = chat.lastCreatedAt
                ? formatCommunityTime(chat.lastCreatedAt)
                : "";
              return (
                <li key={chat.studioId}>
                  <Link
                    href={studioCommunityThreadPath(chat.studioId)}
                    className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
                  >
                    <StudioChatMark
                      name={chat.name}
                      logoUrl={studioChatLogoUrl(chat)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-bold text-foreground">
                          {chat.name}
                        </p>
                        {when ? (
                          <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                            {when}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs font-bold text-primary-ink">
                        Studio chat
                      </p>
                      <p className="mt-1 truncate text-sm leading-5 text-muted-foreground">
                        {studioChatListPreview(chat)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="friend-chats-heading">
        <h2 id="friend-chats-heading" className="text-lg font-bold">
          Friend chats
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Open a thread to message an accepted friend from your studio. You
          will see their name, not their email.
        </p>

        {view === "loading" ? (
          <p className="text-sm font-semibold text-muted-foreground">
            Loading friend chats…
          </p>
        ) : null}

        {view === "error" ? (
          <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
            {error}
          </p>
        ) : null}

        {view === "ready" && incomingCount > 0 ? (
          <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold">
            {incomingCount === 1
              ? "1 friend request is waiting."
              : `${incomingCount} friend requests are waiting.`}{" "}
            <Link href="/kids" className="underline">
              Accept them on Friends
            </Link>{" "}
            before you can chat.
          </p>
        ) : null}

        {view === "ready" && !hasStudio && role !== "studio" && studios.role !== "studio" ? (
          <EmptyState
            title={dancer ? "Link your studio first" : "Link a studio first"}
            body={NO_STUDIO_FRIENDS_BODY}
            action={
              <Link
                href="/studios"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                Browse studios
              </Link>
            }
          />
        ) : null}

        {view === "ready" &&
        (hasStudio || role === "studio" || studios.role === "studio") &&
        conversations.length === 0 ? (
          <EmptyState
            title="No friend chats yet"
            body={
              role === "studio" || studios.role === "studio"
                ? "Friend chat is for parent and dancer accounts at the same studio."
                : dancer
                  ? "Add another dancer from Friends at your studio. Once they accept, the conversation shows up here."
                  : "Add another parent from Friends at your studio. Once they accept, the conversation shows up here."
            }
            action={
              role === "studio" || studios.role === "studio" ? undefined : (
                <Link
                  href="/kids"
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  Find friends at your studio
                </Link>
              )
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
                      Friends at {row.ownChildName}
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
      </section>
    </div>
  );
}
