"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listApprovedStudios, studioPublicPath, type StudioSummary } from "@/lib/studios";

export default function StudiosPage() {
  const { configured } = useAuth();
  const [result, setResult] = useState<{
    studios: StudioSummary[];
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void listApprovedStudios().then((next) => {
      if (cancelled) return;
      setResult({ studios: next.studios, error: next.error ?? "" });
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const studios = result?.studios ?? [];
  const error = result?.error ?? "";
  const loading = configured && result === null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Studios</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Approved dance studios on My Dance Comps. Pending studios stay private until they are approved.
        </p>
      </div>
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Studio listings need the accounts connection. You can still type a studio name on a dancer profile.
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm font-semibold text-muted-foreground">Loading studios…</p>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-status-closed-ink" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && configured && !error && studios.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-sm leading-6 text-muted-foreground shadow-card ring-1 ring-border">
          No approved studios yet. A studio can sign up, then My Dance Comps approves the account before it appears here.
        </p>
      ) : null}
      <ul className="space-y-2">
        {studios.map((studio) => (
          <li key={studio.id}>
            <Link
              href={studioPublicPath(studio)}
              className="block min-h-11 rounded-card bg-surface px-4 py-3 shadow-card ring-1 ring-border"
            >
              <span className="block text-base font-bold">{studio.name}</span>
              <span className="mt-0.5 block text-sm font-medium text-muted-foreground">
                {[studio.suburb, studio.state].filter(Boolean).join(", ")}
                {studio.styles.length ? ` · ${studio.styles.slice(0, 3).join(", ")}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
