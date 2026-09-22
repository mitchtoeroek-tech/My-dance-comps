"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSiblingFriends } from "@/hooks/useSiblingFriends";
import { communityThreadPath } from "@/lib/community";
import { removeFriendship, respondFriendRequest } from "@/lib/friends";
import {
  requestSiblingFriend,
  type SiblingFriendPerson,
} from "@/lib/sibling-friends";

export function SiblingFriendsPanel() {
  const { account } = useAuth();
  const dancer = account?.role === "dancer";
  const linked = Boolean(dancer && account?.familyId && account?.linkedChildId);
  const { view, directory, error, loading, reload } = useSiblingFriends(linked);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  if (!dancer) return null;

  async function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setBusyId(id);
    setNotice("");
    const result = await action();
    setBusyId(null);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    reload();
  }

  return (
    <section
      className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
      aria-labelledby="sibling-friends-heading"
    >
      <h2 id="sibling-friends-heading" className="text-lg font-bold">
        Add sibling
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Add a brother or sister who has their own dancer login in this family.
        When they accept, you can message them in Community — even if you dance
        at different studios. Parents and dancers still cannot be friends.
      </p>

      {!linked ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Join your family first. Then a sibling with their own dancer login
          shows up here.
        </p>
      ) : null}

      {linked && view === "loading" ? (
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Loading siblings…
        </p>
      ) : null}

      {linked && view === "error" ? (
        <p className="mt-3 rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error ?? "Siblings could not be loaded."}
        </p>
      ) : null}

      {linked && view === "ready" && directory && !directory.canAdd ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Sibling friends are for dancer logins that are linked in the same
          family.
        </p>
      ) : null}

      {linked && view === "ready" && directory?.canAdd ? (
        <div className="mt-3 space-y-4">
          {notice ? (
            <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
              {notice}
            </p>
          ) : null}

          {directory.incoming.length > 0 ? (
            <PersonList title="Waiting for you">
              {directory.incoming.map((person) => (
                <li
                  key={person.friendshipId ?? person.userId}
                  className="rounded-control bg-accent-soft px-3 py-3 ring-1 ring-border"
                >
                  <p className="font-bold">{person.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ActionButton
                      label={`Accept ${person.label}`}
                      disabled={loading || busyId !== null}
                      onClick={() =>
                        run(person.userId, () =>
                          respondFriendRequest(person.friendshipId ?? "", true),
                        )
                      }
                    >
                      Accept
                    </ActionButton>
                    <QuietButton
                      label={`Decline ${person.label}`}
                      disabled={loading || busyId !== null}
                      onClick={() =>
                        run(person.userId, () =>
                          respondFriendRequest(person.friendshipId ?? "", false),
                        )
                      }
                    >
                      Decline
                    </QuietButton>
                  </div>
                </li>
              ))}
            </PersonList>
          ) : null}

          <PersonList title="Siblings in your family">
            {directory.suggest.length === 0 ? (
              <li className="text-sm leading-6 text-muted-foreground">
                No other dancer logins in this family yet. A parent can invite
                them, then they join with the family code.
              </li>
            ) : (
              directory.suggest.map((person) => (
                <PersonRow key={person.userId} person={person}>
                  <ActionButton
                    label={`Add sibling ${person.label}`}
                    disabled={loading || busyId !== null}
                    onClick={() =>
                      run(person.userId, () => requestSiblingFriend(person.userId))
                    }
                  >
                    {busyId === person.userId ? "Adding…" : "Add sibling"}
                  </ActionButton>
                </PersonRow>
              ))
            )}
          </PersonList>

          {directory.outgoing.length > 0 ? (
            <PersonList title="Request sent">
              {directory.outgoing.map((person) => (
                <PersonRow key={person.friendshipId ?? person.userId} person={person}>
                  <QuietButton
                    label={`Cancel request to ${person.label}`}
                    disabled={loading || busyId !== null}
                    onClick={() =>
                      run(person.userId, () =>
                        removeFriendship(person.friendshipId ?? ""),
                      )
                    }
                  >
                    Cancel
                  </QuietButton>
                </PersonRow>
              ))}
            </PersonList>
          ) : null}

          {directory.friends.length > 0 ? (
            <PersonList title="Accepted">
              {directory.friends.map((person) => (
                <PersonRow key={person.friendshipId ?? person.userId} person={person}>
                  <div className="flex gap-2">
                    {person.friendshipId ? (
                      <Link
                        href={communityThreadPath(person.friendshipId)}
                        className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-3 text-sm font-bold text-white"
                      >
                        Message
                      </Link>
                    ) : null}
                    <QuietButton
                      label={`Remove ${person.label}`}
                      disabled={loading || busyId !== null}
                      onClick={() => {
                        if (
                          !confirm(
                            `Remove ${person.label} as a sibling friend? This chat will close.`,
                          )
                        ) {
                          return;
                        }
                        void run(person.userId, () =>
                          removeFriendship(person.friendshipId ?? ""),
                        );
                      }}
                    >
                      Remove
                    </QuietButton>
                  </div>
                </PersonRow>
              ))}
            </PersonList>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PersonList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
        {title}
      </p>
      <ul className="mt-2 space-y-2">{children}</ul>
    </div>
  );
}

function PersonRow({
  person,
  children,
}: {
  person: SiblingFriendPerson;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control bg-muted/60 px-3 py-2 ring-1 ring-border">
      <p className="min-w-0 text-sm font-bold text-foreground">
        {person.label}
        <span className="ml-2 text-xs font-bold text-primary-ink">Sibling</span>
      </p>
      {children}
    </li>
  );
}

function ActionButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-primary px-3 text-sm font-bold text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function QuietButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-surface px-3 text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
    >
      {children}
    </button>
  );
}
