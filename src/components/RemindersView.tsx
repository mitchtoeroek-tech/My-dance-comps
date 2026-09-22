"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { kidsSectionLabel } from "@/lib/copy";
import { formatDateTime } from "@/lib/datetime";
import { downloadIcs, mailtoReminders, remindersToIcs } from "@/lib/ics";
import { dancersWithoutStyles, reminderKindLabel } from "@/lib/reminders";
import { EmptyState } from "./EmptyState";
import { useReminderEngine } from "./ReminderEngine";

function readNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function subscribeNotificationPermission(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

function namesPhrase(names: string[]): string {
  if (names.length === 1) return names[0] ?? "A dancer";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function RemindersView() {
  const { user, account } = useAuth();
  const { state, setReminderPrefs } = useFamily();
  const { ready, items, emailConfigured } = useReminderEngine();
  const browserPermission = useSyncExternalStore(
    subscribeNotificationPermission,
    readNotificationPermission,
    () => "unsupported" as const,
  );
  const [requested, setRequested] = useState<NotificationPermission | null>(
    null,
  );
  const permission = requested ?? browserPermission;
  const prefs = state.reminderPrefs;
  const accountEmail = user?.email?.trim() ?? "";
  const missingStyles = dancersWithoutStyles(state.children);
  const stylesPage = kidsSectionLabel(account?.role, state.children.length);
  const bothOff = !prefs.newlyAnnounced && !prefs.onOpen;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reminders</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        In-app reminders for your dancers, using Australia/Adelaide time.
        Browser alerts are optional and only arrive while this site is open.
      </p>
      <p className="text-sm font-semibold leading-6 text-foreground">
        Only comps that match your dancers’ styles.
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        Each dancer’s home state applies, and interstate comps only when you
        have included them. National events are included when the styles match.
        A dancer with no styles selected matches every style until you set
        them on {stylesPage}.
      </p>

      <section className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="font-bold text-foreground">What to remind me about</h2>
        <label className="flex min-h-14 items-center justify-between gap-3 rounded-control bg-primary-soft px-3 py-3 text-sm">
          <span>
            <span className="block font-bold text-foreground">
              Newly announced competitions
            </span>
            <span className="mt-0.5 block text-xs font-medium leading-5 text-primary-ink">
              When a matching comp first appears in the daily listings.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-primary"
            checked={prefs.newlyAnnounced}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, newlyAnnounced: e.target.checked })
            }
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          <span>
            When entries open
            <span className="mt-0.5 block text-xs font-medium leading-5 text-muted-foreground">
              Once, when registration opens for a matching comp.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-primary"
            checked={prefs.onOpen}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, onOpen: e.target.checked })
            }
          />
        </label>
      </section>

      <section className="space-y-2 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          Also email me
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-primary"
            checked={prefs.emailEnabled}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, emailEnabled: e.target.checked })
            }
          />
        </label>
        <p className="text-sm leading-6 text-muted-foreground">
          {emailConfigured && accountEmail
            ? `Due reminders are emailed to ${accountEmail} as well as shown on this page.`
            : emailConfigured
              ? "Due reminders are emailed to your account address when you are signed in. They always show on this page."
              : accountEmail
                ? `Saved for ${accountEmail}. Reminders always show on this page. Server email is not connected yet, so nothing is sent automatically. Email this list opens a draft. We’ll send from My Dance Comps once email delivery is connected.`
                : "Saved on this device. Sign in to use your account email. Server email is not connected yet, so nothing is sent automatically. Email this list opens a draft you can send yourself."}
        </p>
      </section>

      {missingStyles.length > 0 ? (
        <div className="rounded-card bg-accent-soft px-4 py-3 text-sm leading-6 text-foreground ring-1 ring-border">
          <p>
            {namesPhrase(missingStyles.map((child) => child.name))}{" "}
            {missingStyles.length === 1 ? "has" : "have"} no styles selected,
            so reminders include every style in their home state.
          </p>
          <Link
            href="/kids"
            className="mt-1 inline-flex min-h-11 items-center font-bold text-primary-ink"
          >
            Set styles on {stylesPage}
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={items.length === 0}
          onClick={() =>
            downloadIcs("dance-comp-reminders.ics", remindersToIcs(items))
          }
          className="min-h-11 rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border disabled:opacity-50"
        >
          Download .ics
        </button>
        <a
          href={
            prefs.emailEnabled && items.length
              ? mailtoReminders(items, accountEmail)
              : undefined
          }
          className={`inline-flex min-h-11 items-center rounded-control px-4 py-2 text-sm font-bold ${
            prefs.emailEnabled && items.length
              ? "bg-primary text-white"
              : "pointer-events-none bg-surface text-foreground opacity-50 ring-1 ring-border"
          }`}
        >
          Email this list
        </a>
        {permission === "unsupported" ? (
          <p className="self-center text-xs text-muted-foreground">
            This browser does not support notifications.
          </p>
        ) : permission === "granted" ? (
          <p className="self-center text-xs font-semibold text-primary-ink">
            Browser notifications on
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const result = await Notification.requestPermission();
              setRequested(result);
            }}
            className="min-h-11 rounded-control bg-accent px-4 py-2 text-sm font-bold text-foreground"
          >
            Allow browser notifications
          </button>
        )}
      </div>
      {!ready ? (
        <p className="text-sm text-muted-foreground">Checking the latest listings…</p>
      ) : state.children.length === 0 ? (
        <EmptyState
          title="Add a dancer first"
          body="Reminders only cover comps that match your dancers’ styles. Add a dancer and choose their styles."
          action={
            <Link
              href="/kids"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Go to {stylesPage}
            </Link>
          }
        />
      ) : bothOff ? (
        <EmptyState
          title="Reminders are off"
          body="Turn on newly announced competitions or when entries open. Only matching comps are included."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No reminders yet"
          body="The comps already in the listings are marked as seen, so you are not pinged about all of them. A reminder appears when a matching comp is newly announced, or when its entries open."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
                {reminderKindLabel(item.kind)}
              </p>
              <p className="font-bold text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(item.fireAt)}
              </p>
              <p className="mt-1 text-sm leading-6">{item.detail}</p>
              <Link
                href={`/comps/${item.compId}`}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary-ink"
              >
                View comp
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
