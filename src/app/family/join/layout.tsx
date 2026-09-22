import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join your family" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
