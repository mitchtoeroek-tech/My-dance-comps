"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const AUTH_HREFS = new Set([
  "/account",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export function AccountLink() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const active = AUTH_HREFS.has(pathname);

  return (
    <Link
      href="/account"
      className={`ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-xs font-bold ${
        active ? "bg-primary-soft text-primary-ink" : "text-primary-ink"
      }`}
    >
      {ready && user ? "Account" : "Log in"}
      {ready && user ? (
        <span
          className="h-2 w-2 rounded-full bg-primary"
          title="Signed in"
          aria-hidden
        />
      ) : null}
      <span className="sr-only">
        {user ? "Signed in" : "Log in or create an account"}
      </span>
    </Link>
  );
}
