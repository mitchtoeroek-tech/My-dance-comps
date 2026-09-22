"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { useNavBadges } from "@/hooks/useNavBadges";
import { kidsSectionLabel } from "@/lib/copy";

export function BottomNav() {
  const pathname = usePathname();
  const { account } = useAuth();
  const { state } = useFamily();
  const { communityUnread, remindersUnread } = useNavBadges();
  const childrenCount = Array.isArray(state.children) ? state.children.length : 0;
  const dancersLabel = kidsSectionLabel(account?.role, childrenCount);

  const items = [
    { href: "/", label: "Comps", icon: CompIcon },
    { href: "/my-comps", label: "My Comps", icon: MyCompsIcon },
    { href: "/kids", label: dancersLabel, icon: KidsIcon },
    { href: "/community", label: "Community", icon: CommunityIcon },
    { href: "/reminders", label: "Reminders", icon: BellIcon },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/comps")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const longLabel = item.href === "/kids";
          const unread =
            item.href === "/community"
              ? communityUnread
              : item.href === "/reminders"
                ? remindersUnread
                : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={
                  unread
                    ? item.href === "/community"
                      ? "Community, new messages"
                      : "Reminders, new reminders"
                    : undefined
                }
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 font-bold whitespace-nowrap ${
                  longLabel
                    ? "text-[9px] tracking-normal"
                    : "text-[10px] tracking-wide"
                } ${active ? "text-primary-ink" : "text-muted-foreground"}`}
              >
                <span className="relative inline-flex">
                  <Icon active={active} />
                  {unread ? (
                    <span
                      className="absolute top-0 right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface"
                      data-nav-unread={
                        item.href === "/community" ? "community" : "reminders"
                      }
                      aria-hidden
                    />
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MyCompsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 5h10v14H7z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M10 10h4M10 14h4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v12H4zM8 7V5h8v2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M8 12h3M8 16h8"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function KidsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="9"
        cy="8"
        r="2.4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <circle
        cx="16"
        cy="9"
        r="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M4 19c.4-3 2.4-5 5-5s4.6 2 5 5M13 19c.3-2 1.6-3.4 3.4-3.4 1.8 0 3 1.3 3.4 3.4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CommunityIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5h9.5A2.5 2.5 0 0 1 17 9v5.2a2.5 2.5 0 0 1-2.5 2.5H10l-3.6 2.4V16.7H5A1.5 1.5 0 0 1 3.5 15.2V8A1.5 1.5 0 0 1 5 6.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
      />
      <path
        d="M17.2 8.4H19a1.6 1.6 0 0 1 1.6 1.6v5.2a1.6 1.6 0 0 1-1.6 1.6h-1.1v1.8L16 16.8"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 16h12l-1.2-2.2V11a4.8 4.8 0 1 0-9.6 0v2.8L6 16Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
