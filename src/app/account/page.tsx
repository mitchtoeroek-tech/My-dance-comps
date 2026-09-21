"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { AuthUnavailable } from "@/components/AuthCard";

export default function AccountPage() {
  const { configured, ready, user, signOut } = useAuth();
  const { state } = useFamily();

  if (!configured) return <AuthUnavailable />;

  if (!ready) {
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
          Kids, saved comps, enrolled comps and results stay on this device. Friends
          unlock when you sign in. An account is optional — home still works
          without logging in.
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

  const email = user.email ?? "Signed in";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Account</h1>
      <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <p className="text-sm font-semibold text-muted-foreground">Signed in as</p>
        <p className="mt-1 text-lg font-bold text-foreground">{email}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This family’s kids, saved comps, enrolled comps and results sync to
          your account. Friends live on the account too — open a dancer on Kids
          to share an invite. Signing out leaves a copy of family data on this
          device so guest use still works.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Kids" value={String(state.children.length)} />
          <Stat label="Saved" value={String(state.favourites.length)} />
          <Stat label="Entered" value={String(state.enrolled.length)} />
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
      <Link
        href="/kids"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
      >
        Kids and friends
      </Link>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
      >
        Back to comps
      </Link>
    </div>
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
