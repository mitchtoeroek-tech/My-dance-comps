"use client";

import { useState } from "react";
import { FriendCompsList } from "@/components/FriendCompsList";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useFriends } from "@/hooks/useFriends";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";
import { useCompsDateSort } from "@/components/DateSortControl";
import {
  copyText,
  displayFriendCode,
  friendInviteUrl,
  lookupFriendByCode,
  lookupFriendByEmail,
  removeFriendship,
  respondFriendRequest,
  sendFriendRequest,
  setShareEnrolled,
  shareFriendInvite,
  type FriendLookup,
} from "@/lib/friends";

type AddMode = "invite" | "search";

export function FriendsPanel({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const { view, snapshot, error, loading, reload } = useFriends(childId);
  const { comps } = useLiveComps(getComps());
  const { sortDir } = useCompsDateSort();
  const nextPath = `/kids/${childId}`;

  if (view === "guest" || view === "unavailable") {
    return (
      <section className="space-y-3">
        <FriendsHeading />
        <GuestFriendsUnlock nextPath={nextPath} />
      </section>
    );
  }

  if (view === "loading") {
    return (
      <section className="space-y-3">
        <FriendsHeading />
        <p className="text-sm font-semibold text-muted-foreground">
          Loading friends…
        </p>
      </section>
    );
  }

  if (view === "error" || !snapshot) {
    return (
      <section className="space-y-3">
        <FriendsHeading />
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error ?? "Friends could not be loaded."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <FriendsHeading />
      <p className="text-sm leading-6 text-muted-foreground">
        Friends are between dancers, with you in control. You only see comps
        they marked as entered — not favourites, and not their date of birth.
      </p>
      {error ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
      {snapshot.incoming.length > 0 ? (
        <IncomingList
          childName={childName}
          incoming={snapshot.incoming}
          busy={loading}
          onRespond={async (id, accept) => {
            const result = await respondFriendRequest(id, accept);
            if (result.error) return result.error;
            reload();
            return null;
          }}
        />
      ) : null}
      <InviteShareCard
        childName={childName}
        code={snapshot.inviteCode}
      />
      <AddFriendCard
        fromChildId={childId}
        fromChildName={childName}
        busy={loading}
        onSent={reload}
      />
      {snapshot.outgoing.length > 0 ? (
        <OutgoingList
          outgoing={snapshot.outgoing}
          busy={loading}
          onCancel={async (id) => {
            const result = await removeFriendship(id);
            if (result.error) return result.error;
            reload();
            return null;
          }}
        />
      ) : null}
      <ShareEnrolledToggle
        childName={childName}
        shareEnrolled={snapshot.shareEnrolled}
        busy={loading}
        onToggle={async (next) => {
          const result = await setShareEnrolled(childId, next);
          if (!result.error) reload();
        }}
      />
      <AcceptedFriends
        friends={snapshot.friends}
        comps={comps}
        sortDir={sortDir}
        busy={loading}
        onRemove={async (id, name) => {
          if (
            !confirm(
              `Remove ${name} as a friend of ${childName}? They will stop seeing entered comps too.`,
            )
          ) {
            return null;
          }
          const result = await removeFriendship(id);
          if (result.error) return result.error;
          reload();
          return null;
        }}
      />
    </section>
  );
}

function FriendsHeading() {
  return <h2 className="text-xl font-bold">Friends</h2>;
}

function InviteShareCard({
  childName,
  code,
}: {
  childName: string;
  code: string;
}) {
  const [notice, setNotice] = useState("");
  const pretty = displayFriendCode(code);

  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
        Share invite
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Send this to another parent. They tap the link, pick their dancer, then
        you accept.
      </p>
      <p className="mt-3 text-center font-mono text-3xl font-bold tracking-[0.2em] text-foreground">
        {pretty || "••••-••••"}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={async () => {
            const url = friendInviteUrl(window.location.origin, code);
            const result = await shareFriendInvite({
              childName,
              code,
              url,
            });
            if (result === "cancelled") return;
            setNotice(
              result === "shared"
                ? "Invite ready to send."
                : result === "copied"
                  ? "Invite copied."
                  : "Could not share. Copy the link instead.",
            );
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Share invite
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={async () => {
              const url = friendInviteUrl(window.location.origin, code);
              const ok = await copyText(url);
              setNotice(ok ? "Link copied." : "Could not copy the link.");
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-3 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(pretty);
              setNotice(ok ? "Code copied." : "Could not copy the code.");
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-3 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
          >
            Copy code
          </button>
        </div>
      </div>
      {notice ? (
        <p className="mt-2 text-center text-xs font-semibold text-primary-ink">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function AddFriendCard({
  fromChildId,
  fromChildName,
  busy,
  onSent,
}: {
  fromChildId: string;
  fromChildName: string;
  busy: boolean;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<AddMode>("invite");
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
    onSent();
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <p className="text-sm font-bold text-foreground">Add a friend</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Use their invite code, or search with the parent’s email and the
        dancer’s first name.
      </p>
      <div
        role="tablist"
        aria-label="Add friend method"
        className="mt-3 grid grid-cols-2 gap-1 rounded-control bg-muted p-1 ring-1 ring-border"
      >
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
        <ModeTab
          selected={mode === "search"}
          onClick={() => {
            setMode("search");
            setMatches([]);
            setMessage("");
          }}
        >
          Search
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
          <label className="block text-sm font-bold" htmlFor="friend-code">
            Their invite code
            <input
              id="friend-code"
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
          <label className="block text-sm font-bold" htmlFor="friend-email">
            Parent email
            <input
              id="friend-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2 text-sm font-medium"
              required
            />
          </label>
          <label className="block text-sm font-bold" htmlFor="friend-child">
            Dancer’s name
            <input
              id="friend-child"
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
            {pending ? "Searching…" : "Find dancer"}
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

function IncomingList({
  childName,
  incoming,
  busy,
  onRespond,
}: {
  childName: string;
  incoming: { friendshipId: string; name: string }[];
  busy: boolean;
  onRespond: (id: string, accept: boolean) => Promise<string | null>;
}) {
  const [error, setError] = useState("");
  return (
    <div className="rounded-card bg-accent-soft p-4 ring-1 ring-border">
      <p className="text-sm font-bold text-foreground">Waiting for you</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Accept so you can both see entered comps for {childName} and their
        friend.
      </p>
      <ul className="mt-3 space-y-2">
        {incoming.map((item) => (
          <li
            key={item.friendshipId}
            className="rounded-control bg-surface px-3 py-3 ring-1 ring-border"
          >
            <p className="font-bold">{item.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const next = await onRespond(item.friendshipId, true);
                  setError(next ?? "");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-3 text-sm font-bold text-white disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const next = await onRespond(item.friendshipId, false);
                  setError(next ?? "");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-3 text-sm font-bold text-primary-ink ring-1 ring-accent disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OutgoingList({
  outgoing,
  busy,
  onCancel,
}: {
  outgoing: { friendshipId: string; name: string }[];
  busy: boolean;
  onCancel: (id: string) => Promise<string | null>;
}) {
  const [error, setError] = useState("");
  return (
    <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <p className="text-sm font-bold">Waiting for them</p>
      <ul className="mt-2 space-y-2">
        {outgoing.map((item) => (
          <li
            key={item.friendshipId}
            className="flex items-center justify-between gap-2 rounded-control bg-muted px-3 py-2"
          >
            <p className="text-sm font-bold">
              {item.name}
              <span className="ml-2 text-xs font-semibold text-muted-foreground">
                Pending
              </span>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const next = await onCancel(item.friendshipId);
                setError(next ?? "");
              }}
              className="inline-flex min-h-11 items-center rounded-control px-3 text-xs font-bold text-primary-ink"
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ShareEnrolledToggle({
  childName,
  shareEnrolled,
  busy,
  onToggle,
}: {
  childName: string;
  shareEnrolled: boolean;
  busy: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const first = childName.split(" ")[0] || "this dancer";
  return (
    <label className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-[#7bc4a8]"
        checked={shareEnrolled}
        disabled={busy}
        onChange={(event) => void onToggle(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-bold">
          Share {first}’s entered comps with friends
        </span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          Turn this off to keep friends, but hide which comps are marked as
          entered. You can remove a friend any time.
        </span>
      </span>
    </label>
  );
}

function AcceptedFriends({
  friends,
  comps,
  sortDir,
  busy,
  onRemove,
}: {
  friends: {
    friendshipId: string;
    name: string;
    enrolledCompIds: string[];
  }[];
  comps: ReturnType<typeof getComps>;
  sortDir: "asc" | "desc";
  busy: boolean;
  onRemove: (id: string, name: string) => Promise<string | null>;
}) {
  const [error, setError] = useState("");

  if (friends.length === 0) {
    return (
      <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
        No friends yet. Share the invite above, or add a dancer with a code.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">Friends’ comps</h3>
      {friends.map((friend) => (
        <article
          key={friend.friendshipId}
          className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold">{friend.name}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {friend.enrolledCompIds.length === 1
                  ? "1 entered comp"
                  : `${friend.enrolledCompIds.length} entered comps`}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const next = await onRemove(friend.friendshipId, friend.name);
                setError(next ?? "");
              }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-surface px-3 text-xs font-bold text-primary-ink ring-1 ring-accent disabled:opacity-60"
            >
              Remove
            </button>
          </div>
          <FriendCompsList
            friendName={friend.name}
            enrolledCompIds={friend.enrolledCompIds}
            comps={comps}
            sortDir={sortDir}
          />
        </article>
      ))}
      {error ? (
        <p className="text-sm font-semibold text-status-closed-ink">{error}</p>
      ) : null}
    </div>
  );
}
