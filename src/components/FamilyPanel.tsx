"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { displayFamilyCode } from "@/lib/account";
import {
  ensureFamily,
  inviteDancerByEmail,
  joinFamily,
  leaveFamily,
  previewFamilyCode,
  unlinkDancer,
  type FamilyPreviewDancer,
} from "@/lib/family-link";
import { copyText } from "@/lib/friends";

export function FamilyPanel() {
  const { configured, user, account, accountReady, refreshAccount } = useAuth();
  const { state, refreshCloud, removeChild } = useFamily();
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [linkChildId, setLinkChildId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [preview, setPreview] = useState<FamilyPreviewDancer[] | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const familyId = account?.familyId ?? null;
  const role = account?.role ?? null;

  useEffect(() => {
    if (!configured || !user || !accountReady || role !== "parent" || !familyId) {
      return;
    }
    let cancelled = false;
    void ensureFamily().then((result) => {
      if (cancelled || !result.inviteCode) return;
      setInviteCode(result.inviteCode);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, user, accountReady, role, familyId]);

  if (!configured || !user) return null;

  if (account?.role === "studio") return null;

  if (!accountReady || !account) {
    return (
      <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-lg font-bold">Family</h2>
        <p className="mt-1 text-sm text-muted-foreground">Loading family…</p>
      </section>
    );
  }

  const dancers = Array.isArray(state.children) ? state.children : [];
  const unlinked = dancers.filter((child) => !child.linkedUserId);
  const dancer = account.role === "dancer";
  const linkedName =
    dancers.find((child) => child.id === account.linkedChildId)?.name ??
    account.displayName ??
    "You";

  async function afterChange() {
    await refreshAccount();
    refreshCloud();
  }

  async function createCode() {
    setError("");
    setNotice("");
    setPending(true);
    const result = await ensureFamily();
    setPending(false);
    if (result.error || !result.inviteCode) {
      setError(result.error ?? "Could not create a family code.");
      return;
    }
    setInviteCode(result.inviteCode);
    await refreshAccount();
  }

  async function linkToFamily(childId: string | null, label: string) {
    setError("");
    setNotice("");
    setPending(true);
    const result = await joinFamily(joinCode, childId);
    setPending(false);
    if (result.error || !result.ok) {
      setError(result.error ?? "Could not join that family.");
      return;
    }
    setNotice(`You are in the family as ${label}.`);
    setPreview(null);
    await afterChange();
  }

  async function unlink(childId: string, name: string) {
    if (
      !confirm(
        `Remove ${name}'s login from this family? Their account stays, and this profile moves with them.`,
      )
    ) {
      return;
    }
    setError("");
    setNotice("");
    setPending(true);
    const result = await unlinkDancer(childId);
    setPending(false);
    if (result.error || !result.ok) {
      setError(result.error ?? "Could not remove that login.");
      return;
    }
    setNotice(`${name}'s login has left the family.`);
    removeChild(childId);
    await afterChange();
  }

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div>
        <h2 className="text-lg font-bold">Family</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {dancer
            ? "Join your parent's family with their code. You then use the app as yourself — your comps, enrolments, friends and Community."
            : "Create a family code so a dancer can sign in as themselves and still sit on your My Dancers list. You can keep enrolling for them."}
        </p>
      </div>

      {error ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-ink">
          {notice}
        </p>
      ) : null}

      {dancer ? (
        account.linkedChildId ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              You are in the family as <span className="font-bold">{linkedName}</span>.
              Comps, My Comps and friends use your info. Your parent can still
              enrol you.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    "Leave this family? Your parent will no longer see this login on their My Dancers list.",
                  )
                ) {
                  return;
                }
                setError("");
                setNotice("");
                setPending(true);
                void leaveFamily().then(async (result) => {
                  setPending(false);
                  if (result.error || !result.ok) {
                    setError(result.error ?? "Could not leave the family.");
                    return;
                  }
                  setNotice(
                    "You have left the family. Your info stays on this login.",
                  );
                  await afterChange();
                });
              }}
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border disabled:opacity-60"
            >
              Leave family
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              setNotice("");
              setPending(true);
              void previewFamilyCode(joinCode).then((result) => {
                setPending(false);
                if (result.error || !result.ok) {
                  setPreview(null);
                  setError(result.error ?? "That family code was not recognised.");
                  return;
                }
                setPreviewName(result.familyName);
                setPreview(result.dancers);
              });
            }}
          >
            <label className="block text-sm font-bold" htmlFor="family-code">
              Family code
              <input
                id="family-code"
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
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending ? "Please wait…" : "Find family"}
            </button>
            {preview ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {previewName}&apos;s family. Which dancer are you?
                </p>
                <ul className="space-y-2">
                  {preview
                    .filter((row) => !row.linked)
                    .map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void linkToFamily(row.id, row.name)}
                          className="inline-flex min-h-11 w-full items-center rounded-control bg-surface px-3 py-2 text-left text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
                        >
                          I&apos;m {row.name}
                        </button>
                      </li>
                    ))}
                </ul>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void linkToFamily(null, "a new dancer")}
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  I&apos;m not on the list — add me
                </button>
              </div>
            ) : null}
          </form>
        )
      ) : (
        <div className="space-y-3">
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
                onClick={() => {
                  void copyText(displayFamilyCode(inviteCode)).then((ok) => {
                    setCopied(ok);
                  });
                }}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
              >
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => void createCode()}
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending ? "Please wait…" : "Create family code"}
            </button>
          )}

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
                const result = await inviteDancerByEmail(
                  email,
                  linkChildId || null,
                );
                setPending(false);
                if (result.error || !result.ok) {
                  setError(result.error ?? "Could not send that invite.");
                  return;
                }
                if (result.status === "linked") {
                  setNotice("That dancer is linked to your family.");
                  setEmail("");
                  await afterChange();
                  return;
                }
                setNotice(
                  "Invite saved. When they sign up as a dancer with that email, they join this family.",
                );
                setEmail("");
              })();
            }}
          >
            <label className="block text-sm font-bold" htmlFor="dancer-email">
              Invite by email
              <input
                id="dancer-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="dancer@email.com"
                className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
              />
            </label>
            {unlinked.length > 0 ? (
              <label className="block text-sm font-bold" htmlFor="link-child">
                Link to
                <select
                  id="link-child"
                  value={linkChildId}
                  onChange={(event) => setLinkChildId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium"
                >
                  <option value="">A new dancer on my list</option>
                  {unlinked.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
            >
              {pending ? "Please wait…" : "Invite dancer"}
            </button>
          </form>

          {dancers.length > 0 ? (
            <ul className="space-y-2">
              {dancers.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="font-semibold">
                    {child.name}{" "}
                    <span className="font-bold text-primary-ink">
                      {child.linkedUserId ? "· own login" : "· profile only"}
                    </span>
                  </span>
                  {child.linkedUserId ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void unlink(child.id, child.name)}
                      className="inline-flex min-h-11 items-center font-bold text-primary-ink underline disabled:opacity-60"
                    >
                      Remove login
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">
            One dancer belongs to one family. A second parent on the same family
            can wait — this code is for the parent account that created it.
          </p>
        </div>
      )}
    </section>
  );
}
