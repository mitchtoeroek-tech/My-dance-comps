"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CommunityGuidelines } from "@/components/CommunityGuidelines";
import { EmptyState } from "@/components/EmptyState";
import { GuestCommunityUnlock } from "@/components/GuestCommunityUnlock";
import { StudioChatMark } from "@/components/StudioChatMark";
import { useStudioCommunityThread } from "@/hooks/useStudioCommunity";
import { formatCommunityTime } from "@/lib/community";
import { parseStudioId, studioLogoPublicUrl } from "@/lib/studios";
import {
  STUDIO_CHAT_EMPTY_BODY,
  STUDIO_COMMUNITY_MESSAGE_MAX,
  safeStudioSenderLabel,
  studioCommunityThreadPath,
} from "@/lib/studio-community";

export function StudioCommunityThread({ studioId }: { studioId: string }) {
  const id = parseStudioId(studioId);
  const thread = useStudioCommunityThread(id);
  const {
    view,
    studio,
    member,
    accessError,
    messages,
    threadError,
    sending,
    send,
  } = thread;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const nextPath = studioCommunityThreadPath(studioId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, id]);

  if (!id) {
    return (
      <EmptyState
        title="That studio chat link is not valid"
        body="Open Community and pick a studio chat."
        action={<BackButton />}
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

  if (view === "loading") {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm font-semibold text-muted-foreground">
          Opening studio chat…
        </p>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {accessError}
        </p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          title="This studio chat is not open to you"
          body={`${STUDIO_CHAT_EMPTY_BODY} Pending and rejected studios do not have a chat.`}
          action={
            <Link
              href="/studios"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Browse studios
            </Link>
          }
        />
      </div>
    );
  }

  const name = studio?.name ?? "Studio chat";
  const logoUrl = studio
    ? studioLogoPublicUrl(studio.logoPath, studio.updatedAt)
    : null;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-3">
      <div>
        <BackLink />
        <div className="mt-2 flex items-center gap-3">
          <StudioChatMark name={name} logoUrl={logoUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-sm text-muted-foreground">
              Open studio chat. Everyone linked to this approved studio can read
              and send messages.
            </p>
          </div>
        </div>
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
            No messages yet. Say hello to the studio.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderUserId === thread.userId;
            const label = safeStudioSenderLabel(message.senderLabel);
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
                  <p className="text-[11px] font-bold text-primary-ink">{label}</p>
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
        <label htmlFor="studio-community-message" className="sr-only">
          Message {name}
        </label>
        <textarea
          id="studio-community-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={STUDIO_COMMUNITY_MESSAGE_MAX}
          rows={2}
          placeholder={`Message ${name}…`}
          className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {draft.trim().length}/{STUDIO_COMMUNITY_MESSAGE_MAX}
          </p>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
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

function BackButton() {
  return (
    <Link
      href="/community"
      className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
    >
      Back to Community
    </Link>
  );
}
