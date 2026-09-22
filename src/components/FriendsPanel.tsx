"use client";

import { useEffect, useState } from "react";
import { StudioFriendsSection } from "@/components/StudioFriendsSection";
import { useAuth } from "@/context/AuthContext";
import { loadFriendsForChild, setShareEnrolled } from "@/lib/friends";

export function FriendsPanel({
  childId,
  childName,
  studioId,
}: {
  childId: string;
  childName: string;
  studioId: string | null;
}) {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <StudioFriendsSection
        onlyStudioId={studioId}
        nextPath={`/kids/${childId}`}
      />
      {user ? (
        <ShareEnrolledToggle childId={childId} childName={childName} />
      ) : null}
    </div>
  );
}

function ShareEnrolledToggle({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [shareEnrolled, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const first = childName.split(" ")[0] || "this dancer";

  useEffect(() => {
    let cancelled = false;
    void loadFriendsForChild(childId).then((result) => {
      if (cancelled || !result.snapshot) return;
      setShare(result.snapshot.shareEnrolled);
    });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return (
    <label className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-[#7bc4a8]"
        checked={shareEnrolled}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.checked;
          const previous = shareEnrolled;
          setShare(next);
          setBusy(true);
          void setShareEnrolled(childId, next).then((result) => {
            if (result.error) setShare(previous);
            setBusy(false);
          });
        }}
      />
      <span>
        <span className="block text-sm font-bold">
          Share {first}’s enrolled comps with friends
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          Turn this off to keep friends, but hide which comps are marked
          Enrolled. You can remove a friend any time.
        </span>
      </span>
    </label>
  );
}
