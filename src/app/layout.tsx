import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
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
  themeColor: "#c81e5d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-AU"
      className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--cream)] text-[var(--ink)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
