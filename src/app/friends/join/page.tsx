"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { kidsSectionLabel } from "@/lib/copy";
import {
  displayFriendCode,
  lookupFriendByCode,
  normalizeFriendCode,
  sendFriendRequest,
} from "@/lib/friends";

export default function JoinFriendPage() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
          Loading invite…
        </p>
      }
    >
      <JoinFriendInner />
    </Suspense>
  );
}

function JoinFriendInner() {
  const searchParams = useSearchParams();
  const { configured, ready, user, account, accountReady } = useAuth();
  const { state, selectedChild, setSelectedChildId } = useFamily();
  const urlCode = searchParams.get("code") ?? "";
  const [editedCode, setEditedCode] = useState<string | null>(null);
  const code = editedCode ?? (displayFriendCode(urlCode) || urlCode);
  const [friendName, setFriendName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const child = selectedChild ?? state.children[0] ?? null;
  const nextPath = useMemo(() => {
    const normalized = normalizeFriendCode(code);
    return normalized
      ? `/friends/join?code=${encodeURIComponent(displayFriendCode(normalized))}`
      : "/friends/join";
  }, [code]);

  if (!ready || (user && !accountReady)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading invite…
      </p>
    );
  }

  if (!configured || !user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Add friends at your studio</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in, open your studio chat, and tap Add. Parents add other parents.
          Dancers add other dancers. An invite code only works for dancers at the
          same studio.
        </p>
        {code ? (
          <p className="rounded-card bg-surface p-4 text-center font-mono text-2xl font-bold tracking-[0.2em] shadow-card ring-1 ring-border">
            {displayFriendCode(code)}
          </p>
        ) : null}
        <GuestFriendsUnlock nextPath={nextPath} />
      </div>
    );
  }

  if (account?.role === "parent" || account?.role === "studio") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Add friends at your studio</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Invite codes are no longer the way to add friends. Open your studio
          chat and tap Add. Parents add other parents. Dancers add other dancers.
          Same studio only.
        </p>
        {code ? (
          <p className="rounded-card bg-surface p-4 text-center font-mono text-2xl font-bold tracking-[0.2em] shadow-card ring-1 ring-border">
            {displayFriendCode(code)}
          </p>
        ) : null}
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Go to Community
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Request sent</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {friendName || "That dancer"} will show as pending until they accept.
          After that, you can both see enrolled comps.
        </p>
        <Link
          href={child ? `/kids/${child.id}` : "/kids"}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Back to Friends
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add a dance friend</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        This older invite only works for another dancer at the same studio. The
        easy way is your studio chat: open Community and tap Add.
      </p>
      <div className="rounded-card bg-surface p-4 text-center shadow-card ring-1 ring-border">
        <label className="block text-xs font-bold uppercase tracking-wide text-primary-ink" htmlFor="join-code">
          Invite code
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(event) => setEditedCode(event.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          className="mt-2 min-h-11 w-full rounded-control border border-border bg-background px-3 text-center font-mono text-2xl font-bold tracking-[0.2em] uppercase"
        />
      </div>
      {state.children.length === 0 ? (
        <p className="rounded-card bg-accent-soft px-4 py-4 text-sm leading-6">
          {account?.role === "dancer"
            ? "Set up My Info first, then come back to this link."
            : "Add a dancer on My Dancers first, then come back to this link."}
          <Link href="/kids" className="mt-2 block font-bold text-primary-ink underline">
            {account?.role === "dancer" ? "Set up My Info" : "Add a dancer"}
          </Link>
        </p>
      ) : (
        <>
          <label className="block text-sm font-bold">
            This friendship is for
            <select
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm font-medium"
              value={child?.id ?? ""}
              onChange={(event) => setSelectedChildId(event.target.value)}
            >
              {state.children.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !child || !normalizeFriendCode(code)}
            onClick={async () => {
              if (!child) return;
              setPending(true);
              setError("");
              const found = await lookupFriendByCode(code);
              if (found.error) {
                setPending(false);
                setError(found.error);
                return;
              }
              const match = found.matches[0];
              if (!match) {
                setPending(false);
                setError(
                  "We could not find that invite. It may belong to this family, or the code is wrong.",
                );
                return;
              }
              const result = await sendFriendRequest(child.id, match.childId);
              setPending(false);
              if (result.error) {
                setError(result.error);
                return;
              }
              setFriendName(match.name);
              setSent(true);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send friend request"}
          </button>
        </>
      )}
      <Link href="/kids" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline">
        Back to {kidsSectionLabel(account?.role, state.children.length)}
      </Link>
    </div>
  );
}
