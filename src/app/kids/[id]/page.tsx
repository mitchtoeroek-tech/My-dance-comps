"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ChildForm } from "@/components/ChildForm";
import { FriendsPanel } from "@/components/FriendsPanel";
import { ResultLog } from "@/components/ResultLog";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { myDancersLabel } from "@/lib/copy";

export default function KidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { account } = useAuth();
  const { state, upsertChild, removeChild } = useFamily();
  const child = state.children.find((c) => c.id === id);
  const dancerSelf =
    account?.role === "dancer" && account.linkedChildId === child?.id;
  const [editing, setEditing] = useState(false);
  const backLabel = myDancersLabel(state.children.length);

  if (!child) {
    return (
      <div className="space-y-3">
        <p className="font-bold">We could not find that dancer on this device.</p>
        <Link href="/kids" className="text-primary-ink underline">
          Back to {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/kids"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink"
      >
        ← {backLabel}
      </Link>
      {editing ? (
        <ChildForm
          initial={child}
          onSubmit={(next) => {
            upsertChild({ ...next, id: child.id });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
          <h1 className="text-2xl font-bold">{child.name}</h1>
          <p className="text-sm text-muted-foreground">
            Born {child.dob} · Home state {child.homeState}
          </p>
          {child.studio ? (
            child.studioId ? (
              <Link
                href={`/studios/${child.studioId}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-ink underline"
              >
                {child.studio}
              </Link>
            ) : (
              <p className="text-sm font-semibold">{child.studio}</p>
            )
          ) : null}
          <p className="mt-2 text-sm">
            {child.styles?.length ? child.styles.join(" · ") : "All styles"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Edit
            </button>
            {dancerSelf ? null : (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Remove ${child.name} from this device? Results for them will be deleted too.`,
                    )
                  ) {
                    removeChild(child.id);
                  }
                }}
                className="min-h-11 rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-accent"
              >
                Remove
              </button>
            )}
          </div>
        </section>
      )}
      <FriendsPanel childId={child.id} childName={child.name} />
      <ResultLog childId={child.id} />
    </div>
  );
}
