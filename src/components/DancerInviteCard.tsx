"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { displayFamilyCode } from "@/lib/account";
import { ensureFamily, inviteDancerByEmail } from "@/lib/family-link";
import { dancerInviteUrl } from "@/lib/family-invite";
import { copyText } from "@/lib/friends";

export function DancerInviteCard({
  childId,
  childName,
  linked,
}: {
  childId: string;
  childName: string;
  linked: boolean;
}) {
  const { refreshAccount } = useAuth();
  const { refreshCloud } = useFamily();
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (linked) return;
    let cancelled = false;
    void ensureFamily().then((result) => {
      if (cancelled) return;
      if (result.inviteCode) {
        setInviteCode(result.inviteCode);
        setError("");
        return;
      }
      if (result.error) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [linked, attempt]);

  if (linked) {
    return (
      <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-lg font-bold">Own account</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {childName} has their own login. You can still enrol them.
        </p>
      </section>
    );
  }

  async function copyCode() {
    const ok = await copyText(displayFamilyCode(inviteCode));
    setCodeCopied(ok);
    setLinkCopied(false);
  }

  async function copyLink() {
    const url = dancerInviteUrl(window.location.origin, inviteCode, childId);
    const ok = await copyText(url);
    setLinkCopied(ok);
    setCodeCopied(false);
  }

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div>
        <h2 className="text-lg font-bold leading-snug">
          Invite {childName} to their own account
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          They sign up as a dancer, join your family, and keep this profile.
          You can still enrol them.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-ink">
          {notice}
        </p>
      ) : null}

      {inviteCode ? (
        <div className="rounded-control bg-primary-soft px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
            Family code
          </p>
          <p className="mt-1 text-2xl font-bold tracking-wide">
            {displayFamilyCode(inviteCode)}
          </p>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
          >
            {codeCopied ? "Copied" : "Copy family code"}
          </button>
        </div>
      ) : error ? (
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Try again
        </button>
      ) : (
        <p className="text-sm font-semibold text-muted-foreground">
          Preparing the invite…
        </p>
      )}

      <button
        type="button"
        disabled={!inviteCode}
        onClick={() => void copyLink()}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {linkCopied ? "Link copied" : "Copy invite link"}
      </button>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setNotice("");
          setPending(true);
          void (async () => {
            const ensured = inviteCode
              ? { ok: true as const, inviteCode, error: undefined }
              : await ensureFamily();
            if (!ensured.ok || !ensured.inviteCode) {
              setPending(false);
              setError(ensured.error ?? "Could not create a family code.");
              return;
            }
            setInviteCode(ensured.inviteCode);
            const result = await inviteDancerByEmail(email, childId);
            setPending(false);
            if (result.error || !result.ok) {
              setError(result.error ?? "Could not send that invite.");
              return;
            }
            if (result.status === "linked") {
              setNotice(`${childName} is linked to your family.`);
              setEmail("");
              await refreshAccount();
              refreshCloud();
              return;
            }
            setNotice(
              "Invite saved. When they sign up as a dancer with that email, they join on this profile.",
            );
            setEmail("");
          })();
        }}
      >
        <label className="block text-sm font-bold" htmlFor={`dancer-email-${childId}`}>
          Invite by email
          <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
            Optional. They sign up as a dancer with this email and land on this
            profile. A username login uses the invite link.
          </span>
          <input
            id={`dancer-email-${childId}`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="dancer@email.com"
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
        >
          {pending ? "Please wait…" : "Invite by email"}
        </button>
      </form>
    </section>
  );
}
