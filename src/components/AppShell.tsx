import { FamilyProvider } from "@/context/FamilyContext";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FamilyProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-[var(--cream)]">
        <Header />
        <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
        <BottomNav />
      </div>
    </FamilyProvider>
  );
}
