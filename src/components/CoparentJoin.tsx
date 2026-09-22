"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { displayFamilyCode } from "@/lib/account";
import { chatFirstName } from "@/lib/chat-label";
import {
  acceptCoparentInvite,
  previewCoparentInvite,
  saveChatDisplayName,
} from "@/lib/family-link";
import { coparentJoinPath, coparentSignupPath } from "@/lib/family-invite";
import { loginPathWithNext } from "@/lib/friends";

export function CoparentJoin({ code }: { code: string }) {
  const { configured, ready, user, account, accountReady, refreshAccount } =
    useAuth();
  const { refreshCloud } = useFamily();
  const [familyName, setFamilyName] = useState("");
  const [parents, setParents] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);

  const parent = account?.role === "parent";
  const needsName = parent && !chatFirstName(account?.displayName);

  useEffect(() => {
    if (!configured || !ready || !user || !accountReady || !parent) return;
    let cancelled = false;
    void previewCoparentInvite(code).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error ?? "That co-parent invite was not recognised.");
        return;
      }
      setFamilyName(result.familyName);
      setParents(result.parents);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, ready, user, accountReady, parent, code]);

  if (!ready || (user && !accountReady)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading invite…
      </p>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Join as a co-parent</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Create a parent login with this invite. You will share the same
          dancers, enrolments and results. This is not a dancer login.
        </p>
        <p className="rounded-card bg-surface p-4 text-center text-2xl font-bold tracking-wide shadow-card ring-1 ring-border">
          {displayFamilyCode(code)}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={coparentSignupPath(code)}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Create parent account
          </Link>
          <Link
            href={loginPathWithNext(coparentJoinPath(code))}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
          >
            I already have a parent login
          </Link>
        </div>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">This invite is for a parent</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {account?.role === "studio"
            ? "A studio login cannot join a family. The other parent opens this link and signs up as a parent."
            : "You are signed in as a dancer. A co-parent uses their own parent login. Dancers still join with the dancer family code."}
        </p>
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">You are in the family</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          You share this family’s dancers, enrolments and results. Your name in
          studio chat stays the one on your parent account.
        </p>
        <Link
          href="/kids"
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Open My Dancers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Join as a co-parent</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {familyName
          ? `${familyName}’s family. Accept to share their dancers, enrolments and results.`
          : "Accept to share this family’s dancers, enrolments and results."}
      </p>
      <p className="rounded-card bg-surface p-4 text-center text-2xl font-bold tracking-wide shadow-card ring-1 ring-border">
        {displayFamilyCode(code)}
      </p>
      {parents.length > 0 ? (
        <p className="text-sm font-semibold">
          Parents already here: {parents.join(", ")}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {account?.familyId ? (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-muted-foreground">
            You are already in a family. If this invite is for that family,
            open My Dancers. To join a different family, leave yours from
            Account first.
          </p>
          <Link
            href="/kids"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Open My Dancers
          </Link>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setPending(true);
            void (async () => {
              if (needsName) {
                const saved = await saveChatDisplayName(name);
                if (saved.error) {
                  setPending(false);
                  setError(saved.error);
                  return;
                }
                await refreshAccount();
              }
              const result = await acceptCoparentInvite(code);
              setPending(false);
              if (result.error || !result.ok) {
                setError(result.error ?? "Could not join that family.");
                return;
              }
              setJoined(true);
              await refreshAccount();
              refreshCloud();
            })();
          }}
        >
          {needsName ? (
            <label className="block text-sm font-bold" htmlFor="coparent-name">
              Your name (shown in chat)
              <input
                id="coparent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
                className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Please wait…" : "Accept and join"}
          </button>
        </form>
      )}
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
      >
        Back to Account
      </Link>
    </div>
  );
}
