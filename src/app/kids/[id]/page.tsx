"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ChildForm } from "@/components/ChildForm";
import { ResultLog } from "@/components/ResultLog";
import { useFamily } from "@/context/FamilyContext";

export default function KidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state, upsertChild, removeChild } = useFamily();
  const child = state.children.find((c) => c.id === id);
  const [editing, setEditing] = useState(false);

  if (!child) {
    return (
      <div className="space-y-3">
        <p className="font-bold">We could not find that dancer on this device.</p>
        <Link href="/kids" className="text-[var(--teal)] underline">
          Back to Kids
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/kids" className="text-sm font-bold text-[var(--teal)]">
        ← Kids
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
        <section className="rounded-3xl bg-[var(--cream-raised)] p-4 ring-1 ring-[var(--line)]">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            {child.name}
          </h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Born {child.dob} · Home state {child.homeState}
          </p>
          {child.studio ? (
            <p className="text-sm font-semibold">{child.studio}</p>
          ) : null}
          <p className="mt-2 text-sm">
            {child.styles.length ? child.styles.join(" · ") : "All styles"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white"
            >
              Edit
            </button>
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
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--raspberry)] ring-1 ring-[var(--raspberry-soft)]"
            >
              Remove
            </button>
          </div>
        </section>
      )}
      <ResultLog childId={child.id} />
    </div>
  );
}
