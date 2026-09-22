"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { GuestFriendsUnlock } from "@/components/GuestFriendsUnlock";
import { useAuth } from "@/context/AuthContext";
import { useStudioFriends } from "@/hooks/useFriends";
import { communityThreadPath } from "@/lib/community";
import {
  NO_STUDIO_FRIENDS_COPY,
  filterPeopleByQuery,
  removeFriendship,
  respondFriendRequest,
  sendStudioFriendRequest,
  splitStudioPeople,
  type StudioFriendGroup,
  type StudioFriendPerson,
} from "@/lib/friends";

export function StudioFriendsSection({
  onlyStudioId = null,
  nextPath = "/kids",
}: {
  /** When set, only this studio is shown. Null means every linked studio. */
  onlyStudioId?: string | null;
  nextPath?: string;
}) {
  const { account } = useAuth();
  const { view, directory, error, loading, reload } = useStudioFriends();
  const role = directory?.role ?? account?.role ?? "none";

  const studios = useMemo(() => {
    const list = directory?.studios ?? [];
    if (!onlyStudioId) return list;
    return list.filter((studio) => studio.studioId === onlyStudioId);
  }, [directory?.studios, onlyStudioId]);

  if (view === "guest" || view === "unavailable") {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Friends</h2>
        <GuestFriendsUnlock nextPath={nextPath} />
      </section>
    );
  }

  if (view === "loading") {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Friends</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          Loading friends…
        </p>
      </section>
    );
  }

  if (view === "error" || !directory) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Friends</h2>
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error ?? "Friends could not be loaded."}
        </p>
      </section>
    );
  }

  if (role === "studio") {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Friends</h2>
        <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          Friends are for parent and dancer accounts. Your studio chat is in
          Community once the studio is approved.
        </p>
      </section>
    );
  }

  if (studios.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Friends</h2>
        <div className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          <p>{NO_STUDIO_FRIENDS_COPY}.</p>
          <Link
            href="/studios"
            className="mt-3 inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Browse studios
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error}
        </p>
      ) : null}
      {studios.map((studio) => (
        <StudioFriendBlock
          key={studio.studioId}
          studio={studio}
          role={role === "dancer" ? "dancer" : "parent"}
          busy={loading}
          onReload={reload}
        />
      ))}
    </div>
  );
}

function StudioFriendBlock({
  studio,
  role,
  busy,
  onReload,
}: {
  studio: StudioFriendGroup;
  role: "parent" | "dancer";
  busy: boolean;
  onReload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = filterPeopleByQuery(studio.people, query);
  const groups = splitStudioPeople(filtered);
  const noun = role === "dancer" ? "dancers" : "parents";
  const headingId = `friends-${studio.studioId}`;

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className="text-xl font-bold">
          Friends at {studio.studioName}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {role === "dancer"
            ? "Other dancers at this studio. You only see their name and comps they marked Enrolled — not a date of birth."
            : "Other parents with a dancer at this studio. You see a display name or “Parent of …”, never an email."}
        </p>
      </div>

      {groups.incoming.length > 0 ? (
        <PersonList
          title="Waiting for you"
          people={groups.incoming}
          action={(person) => (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => respondFriendRequest(person.friendshipId ?? "", true),
                    setMessage,
                    onReload,
                  )
                }
                aria-label={`Accept ${person.label}`}
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-3 text-sm font-bold text-white disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => respondFriendRequest(person.friendshipId ?? "", false),
                    setMessage,
                    onReload,
                  )
                }
                aria-label={`Decline ${person.label}`}
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-3 text-sm font-bold text-primary-ink ring-1 ring-accent disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          )}
        />
      ) : null}

      <div className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <label className="block text-sm font-bold" htmlFor={`friend-search-${studio.studioId}`}>
          Search {noun} at {studio.studioName}
          <input
            id={`friend-search-${studio.studioId}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name"
            className="mt-1 min-h-11 w-full rounded-control border border-border bg-background px-4 py-2 text-sm font-medium"
          />
        </label>
        {groups.addable.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {query.trim()
              ? `No ${noun} match that search.`
              : `No other ${noun} at ${studio.studioName} yet.`}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {groups.addable.map((person) => (
              <li
                key={person.userId}
                className="flex items-center justify-between gap-2 rounded-control bg-muted px-3 py-2"
              >
                <p className="text-sm font-bold">{person.label}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => sendStudioFriendRequest(studio.studioId, person.userId),
                      setMessage,
                      onReload,
                    )
                  }
                  aria-label={`Add ${person.label}`}
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 text-xs font-bold text-white disabled:opacity-60"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.outgoing.length > 0 ? (
        <PersonList
          title="Waiting for them"
          people={groups.outgoing}
          action={(person) => (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => removeFriendship(person.friendshipId ?? ""),
                  setMessage,
                  onReload,
                )
              }
              aria-label={`Cancel request to ${person.label}`}
              className="inline-flex min-h-11 items-center rounded-control px-3 text-xs font-bold text-primary-ink"
            >
              Cancel
            </button>
          )}
        />
      ) : null}

      <div className="space-y-2">
        <h3 className="text-lg font-bold">Accepted friends</h3>
        {groups.friends.length === 0 ? (
          <p className="rounded-card bg-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            No accepted friends at {studio.studioName} yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {groups.friends.map((person) => (
              <li
                key={person.friendshipId ?? person.userId}
                className="rounded-control bg-surface px-3 py-3 shadow-card ring-1 ring-border"
              >
                <p className="font-bold">{person.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {person.friendshipId ? (
                    <Link
                      href={communityThreadPath(person.friendshipId)}
                      className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 text-xs font-bold text-white"
                    >
                      Message
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !confirm(
                          `Remove ${person.label} as a friend at ${studio.studioName}?`,
                        )
                      ) {
                        return;
                      }
                      void run(
                        () => removeFriendship(person.friendshipId ?? ""),
                        setMessage,
                        onReload,
                      );
                    }}
                    aria-label={`Remove ${person.label}`}
                    className="inline-flex min-h-11 items-center rounded-control bg-surface px-3 text-xs font-bold text-primary-ink ring-1 ring-accent disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {message ? (
        <p className="text-sm font-semibold text-primary-ink">{message}</p>
      ) : null}
    </section>
  );
}

function PersonList({
  title,
  people,
  action,
}: {
  title: string;
  people: StudioFriendPerson[];
  action: (person: StudioFriendPerson) => ReactNode;
}) {
  return (
    <div className="rounded-card bg-accent-soft p-4 ring-1 ring-border">
      <p className="text-sm font-bold">{title}</p>
      <ul className="mt-2 space-y-2">
        {people.map((person) => (
            <li
              key={person.friendshipId ?? person.userId}
              className="space-y-2 rounded-control bg-surface px-3 py-3 ring-1 ring-border"
            >
              <p className="text-sm font-bold">{person.label}</p>
              {action(person)}
            </li>
        ))}
      </ul>
    </div>
  );
}

async function run(
  action: () => Promise<{ error?: string }>,
  setMessage: (value: string) => void,
  onReload: () => void,
) {
  const result = await action();
  if (result.error) {
    setMessage(result.error);
    return;
  }
  setMessage("");
  onReload();
}
