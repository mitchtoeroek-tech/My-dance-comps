import { Suspense } from "react";
import { FamilyProvider } from "@/context/FamilyContext";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { SiteFooter } from "./SiteFooter";

function NavFallback() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", minHeight: "4.25rem" }}
      aria-hidden
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FamilyProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 pb-4 pt-4">{children}</main>
        <SiteFooter />
        <Suspense fallback={<NavFallback />}>
          <BottomNav />
        </Suspense>
      </div>
    </FamilyProvider>
  );
}
