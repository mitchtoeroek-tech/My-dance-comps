import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "My Dance Comps",
    template: "%s · My Dance Comps",
  },
  description:
    "Australian youth dance competitions for families — dates, entries, saved comps and reminders.",
  applicationName: "My Dance Comps",
  appleWebApp: {
    capable: true,
    title: "My Dance Comps",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7BC4A8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={`${dmSans.variable} h-full antialiased`}>
      <body
        className={`${dmSans.className} min-h-full bg-background font-sans text-foreground`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
