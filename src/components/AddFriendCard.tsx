"use client";

import { useState } from "react";
import {
  lookupFriendByCode,
  lookupFriendByEmail,
  sendFriendRequest,
  type FriendLookup,
} from "@/lib/friends";

type AddMode = "search" | "invite";

export function AddFriendCard({
  fromChildId,
  fromChildName,
  busy,
  onSent,
  defaultMode = "search",
}: {
  fromChildId: string;
  fromChildName: string;
  busy?: boolean;
  onSent?: () => void;
  defaultMode?: AddMode;
}) {
  const [mode, setMode] = useState<AddMode>(defaultMode);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [matches, setMatches] = useState<FriendLookup[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function sendTo(match: FriendLookup) {
    setPending(true);
    setMessage("");
    const result = await sendFriendRequest(fromChildId, match.childId);
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMatches([]);
    setCode("");
    setEmail("");
    setChildName("");
    setMessage(`Request sent to ${match.name}. They need to accept.`);
    onSent?.();
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <p className="text-sm font-bold text-foreground">Add a friend by email</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Enter the other parent’s email and their dancer’s first name. The
        request is for <strong>{fromChildName}</strong>. You can also use an
        invite code if they sent you one.
      </p>
      <div
        role="tablist"
        aria-label="Add friend method"
        className="mt-3 grid grid-cols-2 gap-1 rounded-control bg-muted p-1 ring-1 ring-border"
      >
        <ModeTab
          selected={mode === "search"}
          onClick={() => {
            setMode("search");
            setMatches([]);
            setMessage("");
          }}
        >
          Parent email
        </ModeTab>
        <ModeTab
          selected={mode === "invite"}
          onClick={() => {
            setMode("invite");
            setMatches([]);
            setMessage("");
          }}
        >
          Invite code
        </ModeTab>
      </div>
      {mode === "invite" ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setMessage("");
            const result = await lookupFriendByCode(code);
            setPending(false);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            if (result.matches.length === 0) {
              setMessage(
                "We could not find that invite. Check the code, or ask them to share the link again.",
              );
              setMatches([]);
              return;
            }
            if (result.matches.length === 1 && result.matches[0]) {
              await sendTo(result.matches[0]);
              return;
            }
            setMatches(result.matches);
          }}
        >
          <label className="block text-sm font-bold" htmlFor={`friend-code-${fromChildId}`}>
            Their invite code
            <input
              id={`friend-code-${fromChildId}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ABCD-EFGH"
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2 font-mono text-sm font-bold tracking-[0.18em] uppercase"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending || busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Looking up…" : `Add friend for ${fromChildName}`}
          </button>
        </form>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setMessage("");
            const result = await lookupFriendByEmail(email, childName);
            setPending(false);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            if (result.matches.length === 0) {
              setMessage(
                "We could not find that dancer. Check the spelling, or ask for their invite code.",
              );
              setMatches([]);
              return;
            }
            setMatches(result.matches);
          }}
        >
          <label className="block text-sm font-bold" htmlFor={`friend-email-${fromChildId}`}>
            Parent email
            <input
              id={`friend-email-${fromChildId}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2 text-sm font-medium"
              required
            />
          </label>
          <label className="block text-sm font-bold" htmlFor={`friend-child-${fromChildId}`}>
            Their dancer’s name
            <input
              id={`friend-child-${fromChildId}`}
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder="First name as on their profile"
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2 text-sm font-medium"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending || busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Searching…" : `Find dancer for ${fromChildName}`}
          </button>
        </form>
      )}
      {matches.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {matches.map((match) => (
            <li
              key={match.childId}
              className="flex items-center justify-between gap-2 rounded-control bg-primary-soft px-3 py-2"
            >
              <p className="text-sm font-bold">{match.name}</p>
              <button
                type="button"
                disabled={pending || busy}
                onClick={() => void sendTo(match)}
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Send request
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm font-semibold text-primary-ink">{message}</p>
      ) : null}
    </div>
  );
}

function ModeTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`min-h-11 rounded-control px-3 py-2 text-sm font-bold ${
        selected ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
