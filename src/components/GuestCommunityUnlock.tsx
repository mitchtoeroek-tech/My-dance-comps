"use client";

import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import {
  GUEST_COMMUNITY_BODY,
  GUEST_COMMUNITY_TITLE,
} from "@/lib/community";
import { loginPathWithNext, signupPathWithNext } from "@/lib/friends";

export function GuestCommunityUnlock({
  nextPath = "/community",
  compact = false,
}: {
  nextPath?: string;
  compact?: boolean;
}) {
  const actions = (
    <div className="flex flex-wrap justify-center gap-2">
      <Link
        href={loginPathWithNext(nextPath)}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
      >
        Log in
      </Link>
      <Link
        href={signupPathWithNext(nextPath)}
        className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
      >
        Sign up
      </Link>
    </div>
  );

  if (compact) {
    return (
      <div className="rounded-card bg-accent-soft px-4 py-4 ring-1 ring-border">
        <p className="text-sm font-bold text-foreground">{GUEST_COMMUNITY_TITLE}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {GUEST_COMMUNITY_BODY}
        </p>
        <div className="mt-3">{actions}</div>
      </div>
    );
  }

  return (
    <EmptyState
      title={GUEST_COMMUNITY_TITLE}
      body={GUEST_COMMUNITY_BODY}
      action={actions}
    />
  );
}
