"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { displayFamilyCode } from "@/lib/account";
import { parentLeaveConfirmMessage, parentListLabel } from "@/lib/coparent";
import { coparentInviteUrl } from "@/lib/family-invite";
import {
  acceptCoparentInvite,
  ensureCoparentInvite,
  inviteCoparentByEmail,
  leaveParentFamily,
  listFamilyParents,
  listMyCoparentInvites,
  type FamilyParent,
  type MyCoparentInvite,
} from "@/lib/family-link";
import { copyText } from "@/lib/friends";

export function CoparentPanel() {
  const { configured, user, account, accountReady, refreshAccount } = useAuth();
  const { state, refreshCloud } = useFamily();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [parents, setParents] = useState<FamilyParent[]>([]);
  const [invites, setInvites] = useState<MyCoparentInvite[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const familyId = account?.familyId ?? null;
  const role = account?.role ?? null;

  useEffect(() => {
    if (!configured || !user || !accountReady || role !== "parent") return;
    let cancelled = false;
    void (async () => {
      const [parentResult, inviteResult, codeResult] = await Promise.all([
        familyId ? listFamilyParents() : Promise.resolve({ parents: [] }),
        listMyCoparentInvites(),
        familyId ? ensureCoparentInvite() : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setParents(parentResult.parents);
      if (!inviteResult.error) setInvites(inviteResult.invites);
      if (codeResult?.inviteCode) setCode(codeResult.inviteCode);
      setLoadedFor(familyId);
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user, accountReady, role, familyId]);

  if (!configured || !user || role !== "parent") return null;

  const dancers = Array.isArray(state.children) ? state.children : [];
  const linkedDancers = dancers.filter((child) => child.linkedUserId).length;
  const otherParents = parents.filter((parent) => !parent.isYou).length;
  const parentsLoaded = loadedFor === familyId;

  async function afterChange() {
    await refreshAccount();
    refreshCloud();
  }

  async function createInvite() {
    setError("");
    setNotice("");
    setPending(true);
    const result = await ensureCoparentInvite();
    setPending(false);
    if (result.error || !result.inviteCode) {
      setError(result.error ?? "Could not create a co-parent invite.");
      return;
    }
    setCode(result.inviteCode);
    await refreshAccount();
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div>
        <h3 className="text-base font-bold">Invite co-parent</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Another parent signs up or logs in as a parent, accepts this invite,
          and sees the same dancers, enrolments and results. This is separate
          from a dancer’s family code.
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

      {parents.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
            Parents in this family
          </p>
          <ul className="mt-1 space-y-1">
            {parents.map((parent, index) => (
              <li key={`${parent.displayName}-${index}`} className="text-sm font-semibold">
                {parentListLabel(parent)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {invites.length > 0 && !familyId ? (
        <ul className="space-y-2">
          {invites.map((invite) => (
            <li key={invite.code} className="rounded-control bg-primary-soft px-3 py-3">
              <p className="text-sm font-semibold">
                {invite.inviterName} invited you to join their family.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  setNotice("");
                  setPending(true);
                  void acceptCoparentInvite(invite.code).then(async (result) => {
                    setPending(false);
                    if (result.error || !result.ok) {
                      setError(result.error ?? "Could not join that family.");
                      return;
                    }
                    setNotice("You have joined the family.");
                    setInvites((current) =>
                      current.filter((item) => item.code !== invite.code),
                    );
                    await afterChange();
                  });
                }}
                className="mt-2 inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {pending ? "Please wait…" : "Accept invite"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {familyId ? (
        code ? (
          <div className="rounded-control bg-primary-soft px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
              Co-parent code
            </p>
            <p className="mt-1 text-2xl font-bold tracking-wide">
              {displayFamilyCode(code)}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void copyText(displayFamilyCode(code)).then((ok) => {
                    if (ok) setCopied("code");
                  });
                }}
                className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
              >
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = coparentInviteUrl(window.location.origin, code);
                  void copyText(url).then((ok) => {
                    if (ok) setCopied("link");
                  });
                }}
                className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
              >
                {copied === "link" ? "Copied" : "Copy invite link"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void createInvite()}
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Please wait…" : "Create co-parent invite"}
          </button>
        )
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void createInvite()}
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Please wait…" : "Create co-parent invite"}
          </button>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              setNotice("");
              setPending(true);
              void acceptCoparentInvite(joinCode).then(async (result) => {
                setPending(false);
                if (result.error || !result.ok) {
                  setError(result.error ?? "Could not join that family.");
                  return;
                }
                setNotice("You have joined the family.");
                setJoinCode("");
                await afterChange();
              });
            }}
          >
            <label className="block text-sm font-bold" htmlFor="coparent-code">
              Have a co-parent code?
              <input
                id="coparent-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                required
                className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium uppercase"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
            >
              {pending ? "Please wait…" : "Join family"}
            </button>
          </form>
        </div>
      )}

      {familyId && code ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setNotice("");
            setPending(true);
            void inviteCoparentByEmail(email).then((result) => {
              setPending(false);
              if (result.error || !result.ok) {
                setError(result.error ?? "Could not save that invite.");
                return;
              }
              setNotice(
                "Invite saved. When they sign up or log in as a parent with that email, they can accept and join this family.",
              );
              setEmail("");
            });
          }}
        >
          <label className="block text-sm font-bold" htmlFor="coparent-email">
            Invite parent by email
            <input
              id="coparent-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="parent@email.com"
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
          >
            {pending ? "Please wait…" : "Invite co-parent"}
          </button>
        </form>
      ) : null}

      {familyId && parentsLoaded ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const message = parentLeaveConfirmMessage(otherParents, linkedDancers);
            if (linkedDancers > 0 && otherParents === 0) {
              setError(message);
              return;
            }
            if (!confirm(message)) return;
            setError("");
            setNotice("");
            setPending(true);
            void leaveParentFamily().then(async (result) => {
              setPending(false);
              if (result.error || !result.ok) {
                setError(result.error ?? "Could not leave the family.");
                return;
              }
              setCode("");
              setParents([]);
              setNotice(
                result.status === "dissolved"
                  ? "You have left the family. Your dancer profiles stay on this account."
                  : "You have left the family. The other parent still has the dancers.",
              );
              await afterChange();
            });
          }}
          className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border disabled:opacity-60"
        >
          Leave family
        </button>
      ) : null}
    </div>
  );
}
