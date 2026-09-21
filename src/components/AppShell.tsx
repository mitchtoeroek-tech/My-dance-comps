import { AuthProvider } from "@/context/AuthContext";
import { FamilyProvider } from "@/context/FamilyContext";
import { Header } from "./Header";
import { ShellChrome } from "./ShellChrome";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FamilyProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
          <Header />
          <ShellChrome>{children}</ShellChrome>
        </div>
      </FamilyProvider>
    </AuthProvider>
  );
}
