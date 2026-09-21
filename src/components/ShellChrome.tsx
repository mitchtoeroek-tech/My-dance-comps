"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

const AUTH_FLOW = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

function NavFallback() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        minHeight: "4.25rem",
      }}
      aria-hidden
    />
  );
}

export function ShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthFlow = AUTH_FLOW.has(pathname);

  return (
    <>
      <main
        className={`flex-1 px-4 pt-4 ${isAuthFlow ? "pb-8" : "pb-28"}`}
      >
        {children}
      </main>
      {isAuthFlow ? null : (
        <Suspense fallback={<NavFallback />}>
          <BottomNav />
        </Suspense>
      )}
    </>
  );
}
