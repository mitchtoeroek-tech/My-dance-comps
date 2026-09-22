"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useStudioFriends } from "@/hooks/useStudioFriends";
import { communityThreadPath } from "@/lib/community";
import {
  removeStudioFriend,
  requestStudioFriend,
  respondStudioFriend,
  studioFriendIntro,
  type StudioFriendPerson,
} from "@/lib/studio-friends";

export function StudioFriendsPanel({
  studioId,
  studioName,
}: {
  studioId: string;
  studioName: string;
}) {
  const { view, directory, error, loading, reload } = useStudioFriends(studioId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const name = directory?.studioName || studioName;

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
      aria-labelledby="studio-friends-heading"
    >
      <h2 id="studio-friends-heading" className="text-lg font-bold">
        Friends at {name}
      </h2>

      {view === "loading" ? (
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          Loading friends at this studio…
        </p>
      ) : null}

      {view === "error" ? (
        <p className="mt-2 rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
          {error ?? "Friends at this studio could not be loaded."}
        </p>
      ) : null}

      {view === "ready" && directory && !directory.canAdd ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {directory.viewerRole === "studio"
            ? "Friend linking is for parent and dancer logins at this studio. A studio owner is not on that list unless they also have a parent account."
            : `Add friends here once a parent or dancer login is linked to ${name}.`}
        </p>
      ) : null}

      {view === "ready" && directory?.canAdd ? (
        <div className="mt-2 space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {studioFriendIntro(directory.viewerRole, name)}{" "}
            {directory.viewerRole === "dancer"
              ? "Same studio only on this list. A sibling in your family can be added from My Info even at another studio."
              : "Same studio only."}
          </p>

          {notice ? (
            <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
              {notice}
            </p>
          ) : null}

          {directory.incoming.length > 0 ? (
            <PersonList title="Waiting for you">
              {directory.incoming.map((person) => (
                <li key={person.friendshipId ?? person.userId} className="rounded-control bg-accent-soft px-3 py-3 ring-1 ring-border">
                  <p className="font-bold">{person.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <ActionButton
                      label={`Accept ${person.label}`}
                      disabled={loading || busyId !== null}
                      onClick={() =>
                        run(person.userId, () =>
                          respondStudioFriend(person.friendshipId ?? "", true),
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
                          respondStudioFriend(person.friendshipId ?? "", false),
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

          <PersonList title="Add friends here">
            {directory.suggest.length === 0 ? (
              <li className="text-sm leading-6 text-muted-foreground">
                {directory.viewerRole === "dancer"
                  ? "No other dancers to add at this studio right now."
                  : "No other parents to add at this studio right now."}
              </li>
            ) : (
              directory.suggest.map((person) => (
                <PersonRow key={person.userId} person={person}>
                  <ActionButton
                    label={
                      person.sibling
                        ? `Add sibling ${person.label}`
                        : `Add ${person.label}`
                    }
                    disabled={loading || busyId !== null}
                    onClick={() =>
                      run(person.userId, () => requestStudioFriend(studioId, person.userId))
                    }
                  >
                    {busyId === person.userId
                      ? "Adding…"
                      : person.sibling
                        ? "Add sibling"
                        : "Add"}
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
                      run(person.userId, () => removeStudioFriend(person.friendshipId ?? ""))
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
                            `Remove ${person.label} as a friend at ${name}? This chat will close.`,
                          )
                        ) {
                          return;
                        }
                        void run(person.userId, () =>
                          removeStudioFriend(person.friendshipId ?? ""),
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

function PersonList({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
        {title}
      </p>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">{children}</ul>
    </div>
  );
}

function PersonRow({
  person,
  children,
}: {
  person: StudioFriendPerson;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control bg-muted/60 px-3 py-2 ring-1 ring-border">
      <p className="min-w-0 text-sm font-bold text-foreground">
        {person.label}
        {person.sibling ? (
          <span className="ml-2 text-xs font-bold text-primary-ink">Sibling</span>
        ) : null}
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
