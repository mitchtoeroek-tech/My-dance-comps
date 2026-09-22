"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { searchApprovedStudios, type StudioSummary } from "@/lib/studios";

export function StudioLinkField({
  studioId,
  studioName,
  onChange,
}: {
  studioId: string | null;
  studioName: string;
  onChange: (next: { studioId: string | null; studioName: string }) => void;
}) {
  const { configured, user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudioSummary[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const canSearch = configured && Boolean(user);

  useEffect(() => {
    if (!canSearch || studioId || query.trim().length < 2) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchApprovedStudios(query).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setResults(result.studios);
        setSearchError(result.error ?? "");
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [canSearch, query, studioId]);

  const shown =
    !canSearch || studioId || query.trim().length < 2 ? [] : results;

  if (studioId) {
    return (
      <div>
        <p className="text-sm font-bold text-foreground">Dance studio</p>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-control bg-primary-soft px-3 py-2">
          <span className="min-w-0 text-sm font-bold text-foreground">
            Linked to {studioName || "studio"}
          </span>
          <button
            type="button"
            onClick={() => onChange({ studioId: null, studioName })}
            className="min-h-11 shrink-0 text-sm font-bold text-primary-ink underline"
          >
            Remove link
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Only approved studios can be linked. Remove the link to type a name instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-foreground" htmlFor="studio-search">
        Link an approved studio
        <input
          id="studio-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchError("");
          }}
          disabled={!canSearch}
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium disabled:opacity-60"
          placeholder={canSearch ? "Search by studio name" : "Sign in to search studios"}
          autoComplete="off"
        />
      </label>
      {canSearch ? null : (
        <p className="text-xs text-muted-foreground">
          Sign in to link an approved studio. You can still type the studio name below.
        </p>
      )}
      {searching ? (
        <p className="text-xs font-semibold text-muted-foreground">Searching…</p>
      ) : null}
      {searchError ? (
        <p className="text-sm font-semibold text-status-closed-ink" role="alert">
          {searchError}
        </p>
      ) : null}
      {shown.length > 0 ? (
        <ul className="space-y-1" aria-label="Approved studios">
          {shown.map((studio) => (
            <li key={studio.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ studioId: studio.id, studioName: studio.name });
                  setQuery("");
                  setResults([]);
                }}
                className="flex min-h-11 w-full flex-col items-start justify-center rounded-control bg-surface px-3 py-2 text-left ring-1 ring-border"
              >
                <span className="text-sm font-bold text-foreground">{studio.name}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {[studio.suburb, studio.state].filter(Boolean).join(", ") || "Approved studio"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="block text-sm font-bold text-foreground" htmlFor="studio-name-free">
        Or type a studio name
        <input
          id="studio-name-free"
          value={studioName}
          onChange={(event) =>
            onChange({ studioId: null, studioName: event.target.value })
          }
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
          placeholder="If they are not on My Dance Comps yet"
        />
      </label>
    </div>
  );
}
