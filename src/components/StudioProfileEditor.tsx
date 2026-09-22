"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { StyleChecklist, StateSelect } from "@/components/ChildPicker";
import { StudioProfileCard } from "@/components/StudioProfileCard";
import type { AuStateCode, DanceStyle } from "@/lib/types";
import {
  ensureOwnStudio,
  saveOwnStudio,
  studioPublicPath,
  uploadStudioLogo,
  type StudioDraft,
  type StudioRecord,
} from "@/lib/studios";

function draftFromStudio(studio: StudioRecord): StudioDraft {
  return {
    name: studio.name,
    about: studio.about,
    styles: studio.styles,
    addressLine: studio.addressLine,
    suburb: studio.suburb,
    state: studio.state,
    postcode: studio.postcode,
    phone: studio.phone,
    website: studio.website,
    contactEmail: studio.contactEmail,
  };
}

export function StudioProfileEditor() {
  const { configured, ready, user, account, accountReady } = useAuth();
  const [studio, setStudio] = useState<StudioRecord | null>(null);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!configured || !ready || !accountReady || !user || account?.role !== "studio") {
      return;
    }
    let cancelled = false;
    const display =
      account.displayName ||
      (typeof user.user_metadata?.studio_name === "string"
        ? user.user_metadata.studio_name
        : "") ||
      "Dance studio";
    void ensureOwnStudio(user, display).then((result) => {
      if (cancelled) return;
      setLoaded(true);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.studio) {
        setStudio(result.studio);
        setDraft(draftFromStudio(result.studio));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [account, accountReady, configured, ready, user]);

  if (!configured) return null;
  if (!ready || !accountReady || (account?.role === "studio" && user && !loaded)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading studio…
      </p>
    );
  }
  if (!user) {
    return (
      <p className="text-sm font-semibold text-foreground">
        <Link href="/login?next=/studio" className="text-primary-ink underline">
          Log in
        </Link>{" "}
        to edit your studio.
      </p>
    );
  }
  if (account?.role !== "studio" || !draft || !studio) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">
          {error || "This page is for studio accounts. Parents and dancers link a studio from a dancer profile."}
        </p>
        <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline">
          Back to account
        </Link>
      </div>
    );
  }

  const statusCopy =
    studio.status === "approved"
      ? "Your studio is approved and public. Dancers can link to it."
      : studio.status === "rejected"
        ? "This studio was not approved. It is not public and dancers cannot link to it. Contact My Dance Comps if you think this is a mistake."
        : "Awaiting approval. You can fill in your details now. Your studio page goes live, and dancers can link to you, once My Dance Comps approves it.";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Your studio</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground" role="status">
          {statusCopy}
        </p>
      </div>
      {studio.status === "approved" ? (
        <Link
          href={studioPublicPath(studio)}
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          View public page
        </Link>
      ) : null}
      <form
        className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setNotice("");
          setPending(true);
          const result = await saveOwnStudio(studio.id, draft);
          setPending(false);
          if (result.error || !result.studio) {
            setError(result.error || "Could not save your studio.");
            return;
          }
          setStudio(result.studio);
          setDraft(draftFromStudio(result.studio));
          setNotice("Studio details saved.");
        }}
      >
        <label className="block text-sm font-bold" htmlFor="studio-edit-name">
          Studio name
          <input
            id="studio-edit-name"
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-about">
          About the studio
          <textarea
            id="studio-about"
            value={draft.about}
            maxLength={2000}
            rows={4}
            onChange={(event) => setDraft({ ...draft, about: event.target.value })}
            className="mt-1 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            placeholder="Ages, faculty, what families should know"
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-bold">Dance styles</p>
          <StyleChecklist
            value={draft.styles}
            onChange={(styles) =>
              setDraft({ ...draft, styles: styles as DanceStyle[] })
            }
          />
        </div>
        <label className="block text-sm font-bold" htmlFor="studio-address">
          Street address
          <input
            id="studio-address"
            value={draft.addressLine}
            onChange={(event) => setDraft({ ...draft, addressLine: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            autoComplete="street-address"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-suburb">
          Suburb
          <input
            id="studio-suburb"
            value={draft.suburb}
            onChange={(event) => setDraft({ ...draft, suburb: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            autoComplete="address-level2"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-state">
          State
          <div className="mt-1">
            <StateSelect
              id="studio-state"
              value={draft.state}
              onChange={(state) =>
                setDraft({ ...draft, state: state as AuStateCode })
              }
            />
          </div>
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-postcode">
          Postcode
          <input
            id="studio-postcode"
            inputMode="numeric"
            value={draft.postcode}
            onChange={(event) => setDraft({ ...draft, postcode: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            autoComplete="postal-code"
            placeholder="5000"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-phone">
          Phone
          <input
            id="studio-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            autoComplete="tel"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-email">
          Contact email
          <input
            id="studio-email"
            type="email"
            value={draft.contactEmail}
            onChange={(event) => setDraft({ ...draft, contactEmail: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-website">
          Website
          <input
            id="studio-website"
            value={draft.website}
            onChange={(event) => setDraft({ ...draft, website: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            placeholder="studio.com.au"
            autoComplete="url"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="studio-logo">
          Logo
          <input
            id="studio-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 block w-full text-sm font-medium"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setError("");
              setNotice("");
              setPending(true);
              const result = await uploadStudioLogo(studio.id, file);
              setPending(false);
              if (result.error || !result.studio) {
                setError(result.error || "Could not upload that logo.");
                return;
              }
              setStudio(result.studio);
              setNotice("Logo uploaded.");
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
        {error ? (
          <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-ink" role="status">
            {notice}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Please wait…" : "Save studio"}
        </button>
      </form>
      <StudioProfileCard studio={{ ...studio, ...draft, styles: draft.styles }} />
    </div>
  );
}
