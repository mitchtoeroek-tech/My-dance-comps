import { AuthProvider } from "@/context/AuthContext";
import { FamilyProvider } from "@/context/FamilyContext";
import { Header } from "./Header";
import { ReminderEngine } from "./ReminderEngine";
import { ShellChrome } from "./ShellChrome";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FamilyProvider>
        <ReminderEngine>
          <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background">
            <Header />
            <ShellChrome>{children}</ShellChrome>
          </div>
        </ReminderEngine>
      </FamilyProvider>
    </AuthProvider>
  );
}
