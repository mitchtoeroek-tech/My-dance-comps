"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { AuthUnavailable } from "@/components/AuthCard";
import { FamilyPanel } from "@/components/FamilyPanel";
import {
  chatFirstName,
  parentStudioChatLines,
  studioChatSenderLabel,
} from "@/lib/chat-label";
import { kidsSectionLabel, myDancersLabel } from "@/lib/copy";
import { saveChatDisplayName } from "@/lib/family-link";
import { isAllowlistedAdmin } from "@/lib/studios";

export default function AccountPage() {
  const { configured, ready, accountReady, user, account, signOut } = useAuth();
  const { state, enrolledIdsFor } = useFamily();

  if (!configured) return <AuthUnavailable />;

  if (!ready || (user && !accountReady)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading account…
      </p>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          You are using <strong className="font-bold text-foreground">guest mode</strong>.
          Your dancers, enrolled comps and results stay on this device.
          Sign in to add friends by email and share enrolled comps. Home still
          works as a guest.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
          >
            Log in
          </Link>
        </div>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline">
          Continue as guest
        </Link>
      </div>
    );
  }

  const email = account?.username || user.email || "Signed in";
  const dancerChild =
    state.children.find((child) => child.id === account?.linkedChildId) ??
    state.children[0];
  const enrolledCount =
    account?.role === "dancer"
      ? enrolledIdsFor(dancerChild?.id ?? null).length
      : enrolledIdsFor(null).length;
  const resultCount =
    account?.role === "dancer"
      ? state.results.filter((result) => result.childId === dancerChild?.id).length
      : state.results.length;
  const dancerChatName =
    account?.role === "dancer"
      ? studioChatSenderLabel({
          role: "dancer",
          displayName: account.displayName,
          dancerName: dancerChild?.name,
          linkedDancer: Boolean(account.linkedChildId),
        })
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Account</h1>
      <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <p className="text-sm font-semibold text-muted-foreground">Signed in as</p>
        <p className="mt-1 text-lg font-bold text-foreground">{email}</p>
        <p className="mt-1 text-sm font-bold text-primary-ink">
          {account?.role === "dancer"
            ? "Dancer account"
            : account?.role === "studio"
              ? "Studio account"
              : "Parent account"}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {account?.role === "studio"
            ? "Your studio stays private until My Dance Comps approves it. Add your logo, styles and address, then dancers can link to you once you are approved."
            : account?.role === "dancer"
              ? "Your comps, enrolments, results, friends and Community follow this login. Add placings from Results or My Info. Link your studio from My Info. Join a family so a parent can see you on My Dancers and enrol you too."
              : `This family’s dancers, enrolled comps and results sync to your account. Invite another parent from Family so you both see the same dancers. Open a dancer on ${myDancersLabel(state.children.length)} to invite their own login, link a studio, or share a friend invite. Signing out leaves a copy on this device.`}
        </p>
        {dancerChatName ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            In studio chat you show as{" "}
            <span className="font-bold text-foreground">{dancerChatName}</span>.
            That is your first name, plus the initial of your surname when you
            have one, taken from My Info.
          </p>
        ) : null}
        <nav
          aria-label="Family summary"
          className="mt-3 grid grid-cols-2 gap-2 text-sm"
        >
          <Stat
            href="/kids"
            label={kidsSectionLabel(account?.role, state.children.length)}
            value={String(state.children.length)}
          />
          <Stat
            href="/my-comps"
            label="Enrolled"
            value={String(enrolledCount)}
          />
          <Stat
            href="/results"
            label="Results"
            value={String(resultCount)}
          />
        </nav>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border"
        >
          Sign out
        </button>
      </section>
      {account?.role === "parent" ? <ChatNameForm /> : null}
      <PasswordOrPinForm />
      <FamilyPanel />
      <div className="flex flex-col items-start gap-1">
        {account?.role === "studio" ? (
          <Link
            href="/studio"
            className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
          >
            Edit studio profile
          </Link>
        ) : null}
        {account?.role === "dancer" ? (
          <Link
            href={
              account?.linkedChildId
                ? `/kids/${account.linkedChildId}`
                : "/kids"
            }
            className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
          >
            Link your studio
          </Link>
        ) : null}
        {isAllowlistedAdmin(user.email) ? (
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
          >
            Approve studios
          </Link>
        ) : null}
        <Link
          href="/studios"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          Approved studios
        </Link>
        <Link
          href="/kids"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          {kidsSectionLabel(account?.role, state.children.length)} and friends
        </Link>
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          Community chat
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          Back to comps
        </Link>
      </div>
    </div>
  );
}

function ChatNameForm() {
  const { account, refreshAccount } = useAuth();
  const { state } = useFamily();
  const saved =
    account?.displayName && !account.displayName.includes("@")
      ? account.displayName
      : "";
  const [name, setName] = useState(saved);
  const [baseline, setBaseline] = useState(saved);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  if (saved !== baseline) {
    setBaseline(saved);
    setName(saved);
  }

  const lines = parentStudioChatLines(
    name.includes("@") ? "" : name,
    (Array.isArray(state.children) ? state.children : []).map((child) => ({
      name: child.name,
      studio: child.studio,
    })),
  );
  const needsName = !chatFirstName(saved);

  return (
    <form
      className="space-y-2 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        setPending(true);
        const result = await saveChatDisplayName(name);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setNotice("Name saved. New studio messages will use it.");
        await refreshAccount();
      }}
    >
      <h2 className="text-lg font-bold">Your name</h2>
      <p id="chat-name-hint" className="text-sm leading-6 text-muted-foreground">
        Shown in studio chat as your first name with the dancers at that studio.
        For example, Sarah, parent of Evie and Harriet.
      </p>
      {needsName ? (
        <p className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-ink">
          Add your name so studio chat can show who is writing. Until you save
          one, messages use Parent.
        </p>
      ) : null}
      <label className="block text-sm font-bold" htmlFor="chat-display-name">
        Your name (shown in chat)
        <input
          id="chat-display-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={80}
          aria-describedby="chat-name-hint"
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
        />
      </label>
      <div className="text-sm leading-6 text-muted-foreground">
        {lines.length <= 1 ? (
          <p>
            In studio chat you show as{" "}
            <span className="font-bold text-foreground">
              {lines[0]?.label ?? "Parent"}
            </span>
            .
          </p>
        ) : (
          <>
            <p>Each studio chat lists only the dancers linked to that studio.</p>
            <ul className="mt-1 space-y-1">
              {lines.map((line) => (
                <li key={line.studio ?? "dancers"}>
                  <span className="font-bold text-foreground">
                    {line.studio ?? "No studio yet"}:
                  </span>{" "}
                  {line.label}
                </li>
              ))}
            </ul>
          </>
        )}
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
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Please wait…" : "Save name"}
      </button>
    </form>
  );
}

function PasswordOrPinForm() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-2 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        setPending(true);
        const result = await updatePassword(password);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPassword("");
        setNotice("Password or PIN updated.");
      }}
    >
      <h2 className="text-lg font-bold">Change password or PIN</h2>
      <label className="block text-sm font-bold" htmlFor="new-password">
        New password or PIN
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium"
        />
      </label>
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
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Please wait…" : "Update"}
      </button>
    </form>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const className =
    "block h-full min-h-11 rounded-control bg-primary-soft px-3 py-2";
  const body = (
    <>
      <span className="block text-xs font-bold uppercase tracking-wide text-primary-ink">
        {label}
      </span>
      <span className="block text-lg font-bold text-foreground">{value}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
