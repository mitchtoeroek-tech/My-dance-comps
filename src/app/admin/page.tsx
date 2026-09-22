"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthUnavailable } from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";
import {
  claimAdminAccess,
  deleteStudio,
  isAllowlistedAdmin,
  listStudiosForAdmin,
  setStudioStatus,
  studioPublicPath,
  type StudioRecord,
} from "@/lib/studios";

export default function AdminStudiosPage() {
  const { configured, ready, user } = useAuth();
  const [pendingStudios, setPendingStudios] = useState<StudioRecord[]>([]);
  const [approvedStudios, setApprovedStudios] = useState<StudioRecord[]>([]);
  const [rejectedStudios, setRejectedStudios] = useState<StudioRecord[]>([]);
  const [gate, setGate] = useState<{ userId: string; allowed: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const [pending, approved, rejected] = await Promise.all([
      listStudiosForAdmin("pending"),
      listStudiosForAdmin("approved"),
      listStudiosForAdmin("rejected"),
    ]);
    setPendingStudios(pending.studios);
    setApprovedStudios(approved.studios);
    setRejectedStudios(rejected.studios);
    setError(pending.error || approved.error || rejected.error || "");
  }, []);

  useEffect(() => {
    if (!configured || !ready || !user) return;
    let cancelled = false;
    void (async () => {
      const claim = await claimAdminAccess(user.id);
      if (cancelled) return;
      const isAdmin = claim.isAdmin || isAllowlistedAdmin(user.email);
      if (!isAdmin) setError(claim.error ?? "");
      if (isAdmin) await load();
      if (!cancelled) setGate({ userId: user.id, allowed: isAdmin });
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, load, ready, user]);

  if (!configured) return <AuthUnavailable />;

  const allowed = Boolean(
    user && gate && gate.userId === user.id && gate.allowed,
  );
  const checking = Boolean(user && (!gate || gate.userId !== user.id));

  if (!ready || checking) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading admin…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="text-sm font-semibold">
        <Link href="/login?next=/admin" className="text-primary-ink underline">
          Log in
        </Link>{" "}
        to review studio accounts.
      </p>
    );
  }

  if (!allowed) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Studio approval</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This page is for My Dance Comps admins.
        </p>
        <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline">
          Back to account
        </Link>
      </div>
    );
  }

  async function decide(studio: StudioRecord, status: "approved" | "rejected") {
    setBusyId(studio.id);
    setError("");
    const result = await setStudioStatus(studio.id, status);
    setBusyId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  async function remove(studio: StudioRecord) {
    const name = studio.name.trim() || "this studio";
    if (
      !confirm(
        `Delete ${name}? Dancers linked to it will be unlinked. Its chat, friend links and logo will be removed, and it will leave Approved studios. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(studio.id);
    setError("");
    const result = await deleteStudio(studio.id);
    setBusyId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Studio approval</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Approve a studio before its page is public and dancers can link to it. Reject keeps it private. Delete unlinks dancers, removes its chat, and takes it off Approved studios.
        </p>
      </div>
      {error ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink" role="alert">
          {error}
        </p>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Awaiting approval</h2>
        {pendingStudios.length === 0 ? (
          <p className="text-sm text-muted-foreground">No studios are waiting.</p>
        ) : (
          <ul className="space-y-2">
            {pendingStudios.map((studio) => (
              <StudioDecision
                key={studio.id}
                studio={studio}
                busy={busyId === studio.id}
                onApprove={() => void decide(studio, "approved")}
                onReject={() => void decide(studio, "rejected")}
                onDelete={() => void remove(studio)}
              />
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Approved studios</h2>
        {approvedStudios.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved studios.</p>
        ) : (
          <ul className="space-y-2">
            {approvedStudios.map((studio) => (
              <StudioDecision
                key={studio.id}
                studio={studio}
                busy={busyId === studio.id}
                onDelete={() => void remove(studio)}
              />
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Not approved</h2>
        {rejectedStudios.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-2">
            {rejectedStudios.map((studio) => (
              <StudioDecision
                key={studio.id}
                studio={studio}
                busy={busyId === studio.id}
                onApprove={() => void decide(studio, "approved")}
                onDelete={() => void remove(studio)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StudioDecision({
  studio,
  busy,
  onApprove,
  onReject,
  onDelete,
}: {
  studio: StudioRecord;
  busy: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <p className="text-lg font-bold">{studio.name}</p>
      <p className="text-sm text-muted-foreground">
        {[studio.suburb, studio.state].filter(Boolean).join(", ") || "No address yet"}
      </p>
      {studio.about ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6">{studio.about}</p>
      ) : null}
      <p className="mt-1 text-sm">
        {studio.styles.length ? studio.styles.join(" · ") : "No styles yet"}
      </p>
      <Link
        href={studioPublicPath(studio)}
        className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
      >
        Preview
      </Link>
      <div className="mt-2 flex flex-wrap gap-2">
        {onApprove ? (
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Approve
          </button>
        ) : null}
        {onReject ? (
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border disabled:opacity-60"
          >
            Reject
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="inline-flex min-h-11 items-center rounded-control bg-status-closed px-4 py-2 text-sm font-bold text-status-closed-ink ring-1 ring-status-closed-ink disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
