"use client";

import Image from "next/image";
import Link from "next/link";

const fieldClass =
  "mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <Image
          src="/logo.png"
          alt="My Dance Comps"
          width={900}
          height={1080}
          className="h-auto w-[min(100%,11.5rem)] object-contain"
          priority
        />
      </div>
      <section className="rounded-card bg-surface p-5 shadow-card ring-1 ring-border">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block text-sm font-bold text-foreground" htmlFor={id}>
      {label}
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </label>
  );
}

export function AuthSubmit({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink">
      {message}
    </p>
  );
}

export function AuthLinks({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-center text-sm font-medium text-muted-foreground">
      {children}
    </p>
  );
}

export function AuthTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="font-bold text-primary-ink underline">
      {children}
    </Link>
  );
}

export function AuthUnavailable() {
  return (
    <AuthCard
      title="Keep going as a guest"
      subtitle="Accounts are not connected in this environment yet. Kids, saved comps and results still stay on this device."
    >
      <Link
        href="/"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2.5 text-sm font-bold text-white"
      >
        Back to comps
      </Link>
    </AuthCard>
  );
}
