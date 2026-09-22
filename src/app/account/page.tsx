"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { AuthUnavailable } from "@/components/AuthCard";
import { FamilyPanel } from "@/components/FamilyPanel";
import { myDancersLabel } from "@/lib/copy";
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
          Your dancers, saved comps, enrolled comps and results stay on this device.
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
  const enrolledCount =
    account?.role === "dancer"
      ? enrolledIdsFor(state.children[0]?.id ?? null).length
      : enrolledIdsFor(null).length;

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
              ? "Your comps, enrolments, friends and Community follow this login. Link your studio from your profile. Join a family so a parent can see you on My Dancers and enrol you too."
              : `This family’s dancers, saved comps, enrolled comps and results sync to your account. Friends live on the account too — open a dancer on ${myDancersLabel(state.children.length)} to invite their own login, link a studio, or share a friend invite. Signing out leaves a copy on this device.`}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Stat
            label={myDancersLabel(state.children.length)}
            value={String(state.children.length)}
          />
          <Stat label="Saved" value={String(state.favourites.length)} />
          <Stat label="Enrolled" value={String(enrolledCount)} />
          <Stat label="Results" value={String(state.results.length)} />
        </dl>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border"
        >
          Sign out
        </button>
      </section>
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
          {myDancersLabel(state.children.length)} and friends
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-primary-soft px-3 py-2">
      <dt className="text-xs font-bold uppercase tracking-wide text-primary-ink">
        {label}
      </dt>
      <dd className="text-lg font-bold text-foreground">{value}</dd>
    </div>
  );
}
