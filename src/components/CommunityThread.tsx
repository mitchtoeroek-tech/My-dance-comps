"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CommunityGuidelines } from "@/components/CommunityGuidelines";
import { EmptyState } from "@/components/EmptyState";
import { GuestCommunityUnlock } from "@/components/GuestCommunityUnlock";
import { useCommunityThread } from "@/hooks/useCommunity";
import {
  COMMUNITY_MESSAGE_MAX,
  communityThreadPath,
  formatCommunityTime,
  isCommunityFriendshipId,
} from "@/lib/community";

export function CommunityThread({ friendshipId }: { friendshipId: string }) {
  const valid = isCommunityFriendshipId(friendshipId);
  const thread = useCommunityThread(valid ? friendshipId : null);
  const {
    view,
    conversation,
    loading,
    messages,
    threadError,
    sending,
    send,
    userId,
  } = thread;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, friendshipId]);

  const nextPath = communityThreadPath(friendshipId);

  if (!valid) {
    return (
      <EmptyState
        title="That chat link is not valid"
        body="Open Community and pick a friend conversation."
        action={
          <Link
            href="/community"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Back to Community
          </Link>
        }
      />
    );
  }

  if (view === "guest" || view === "unavailable") {
    return (
      <div className="space-y-4">
        <BackLink />
        <GuestCommunityUnlock nextPath={nextPath} />
      </div>
    );
  }

  if ((view === "loading" || loading) && !conversation) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm font-semibold text-muted-foreground">
          Opening chat…
        </p>
      </div>
    );
  }

  if (view === "error" && !conversation) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {thread.error}
        </p>
      </div>
    );
  }

  if (!loading && view === "ready" && !conversation) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          title="That chat is friends-only"
          body="You can only message accepted friends. If you just added them, wait until they accept."
          action={
            <Link
              href="/community"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Back to Community
            </Link>
          }
        />
      </div>
    );
  }

  const friendName = conversation?.friendName ?? "Friend";
  const ownName = conversation?.ownChildName ?? "your dancer";

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-3">
      <div>
        <BackLink />
        <h1 className="mt-2 text-2xl font-bold">{friendName}</h1>
        <p className="text-sm text-muted-foreground">
          Friends at {ownName}. Only the two of you can see this thread.
        </p>
        <CommunityGuidelines />
      </div>

      {threadError ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {threadError}
        </p>
      ) : null}

      <div
        className="flex-1 space-y-2 overflow-y-auto rounded-card bg-muted/60 p-3 ring-1 ring-border"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No messages yet. Say hello to {friendName}.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderUserId === userId;
            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-card px-3 py-2 ring-1 ${
                    mine
                      ? "bg-primary-soft text-foreground ring-primary/30"
                      : "bg-surface text-foreground ring-border"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-5">
                    {message.body}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {formatCommunityTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 space-y-2 bg-background pb-1 pt-1"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await send(draft);
          if (!result.error) setDraft("");
        }}
      >
        <label htmlFor="community-message" className="sr-only">
          Message {friendName}
        </label>
        <textarea
          id="community-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={COMMUNITY_MESSAGE_MAX}
          rows={2}
          placeholder={`Message ${friendName}…`}
          className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {draft.trim().length}/{COMMUNITY_MESSAGE_MAX}
          </p>
          <button
            type="submit"
            disabled={sending || !draft.trim() || !conversation}
            className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/community"
      className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink"
    >
      ← Community
    </Link>
  );
}
