"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Comps", icon: CompIcon },
  { href: "/my-comps", label: "My Comps", icon: MyCompsIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/kids", label: "Kids", icon: KidsIcon },
  { href: "/saved", label: "Saved", icon: SavedIcon },
  { href: "/reminders", label: "Reminders", icon: BellIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/comps")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 text-[10px] font-bold tracking-wide whitespace-nowrap ${
                  active ? "text-primary-ink" : "text-muted-foreground"
                }`}
              >
                <Icon active={active} />
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
      <path
        d="M12 4.6 13 6.7l2.3.3-1.7 1.6.4 2.3L12 9.8l-2 1.1.4-2.3-1.7-1.6 2.3-.3L12 4.6Z"
        stroke="currentColor"
        strokeWidth={active ? 1.8 : 1.5}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
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

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M8 4v4M16 4v4M4 10h16"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <circle cx="9" cy="14" r="1.1" fill="currentColor" />
      <circle cx="12.5" cy="14" r="1.1" fill="currentColor" />
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

function SavedIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4.8 14.2 9l4.8.6-3.5 3.3.9 4.7L12 15.7 7.6 17.6l.9-4.7L5 9.6 9.8 9 12 4.8Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
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
