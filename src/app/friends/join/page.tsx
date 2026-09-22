"use client";

import Link from "next/link";

export default function JoinFriendPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Friends stay at your studio</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Invite codes and email search are no longer used. Parents can add other
        parents, and dancers can add other dancers, when you share an approved
        studio.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/kids"
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Friends at your studio
        </Link>
        <Link
          href="/studios"
          className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
        >
          Browse studios
        </Link>
      </div>
    </div>
  );
}
