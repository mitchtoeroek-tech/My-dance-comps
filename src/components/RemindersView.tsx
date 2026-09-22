"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { getComps } from "@/lib/comps";
import { enrolledIdsForChild } from "@/lib/enrolled";
import { formatDateTime } from "@/lib/datetime";
import {
  downloadIcs,
  mailtoReminders,
  remindersToIcs,
} from "@/lib/ics";
import {
  buildReminders,
  upcomingReminders,
} from "@/lib/reminders";
import { EmptyState } from "./EmptyState";
import { useLiveComps } from "@/hooks/useLiveComps";

function readNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function subscribeNotificationPermission(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

export function RemindersView() {
  const { state, setReminderPrefs } = useFamily();
  const browserPermission = useSyncExternalStore(
    subscribeNotificationPermission,
    readNotificationPermission,
    () => "unsupported" as const,
  );
  const [requested, setRequested] = useState<NotificationPermission | null>(
    null,
  );
  const permission = requested ?? browserPermission;

  const { comps } = useLiveComps(getComps());
  const enrolledIds = useMemo(
    () => enrolledIdsForChild(state.enrolled, state.enrolledByChild, null),
    [state.enrolled, state.enrolledByChild],
  );
  const items = useMemo(
    () =>
      upcomingReminders(
        buildReminders(comps, state.reminderPrefs, enrolledIds),
      ),
    [comps, enrolledIds, state.reminderPrefs],
  );

  const prefs = state.reminderPrefs;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reminders</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Nudges for enrolled comps, using Australia/Adelaide time. No paid
        notification service — browser alerts only work while this site is open
        (or installed) after you allow them.
      </p>
      <section className="space-y-2 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="font-bold text-foreground">When to remind me</h2>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          When entries open
          <input
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={prefs.onOpen}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, onOpen: e.target.checked })
            }
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          1 week before entries close
          <input
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={prefs.weekBeforeClose}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, weekBeforeClose: e.target.checked })
            }
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          1 day before entries close
          <input
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={prefs.dayBeforeClose}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, dayBeforeClose: e.target.checked })
            }
          />
        </label>
      </section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={items.length === 0}
          onClick={() =>
            downloadIcs("dance-comp-reminders.ics", remindersToIcs(items))
          }
          className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Download .ics
        </button>
        <a
          href={items.length ? mailtoReminders(items) : undefined}
          className={`inline-flex min-h-11 items-center rounded-control bg-surface px-4 py-2 text-sm font-bold ring-1 ring-border ${
            items.length ? "text-foreground" : "pointer-events-none opacity-50"
          }`}
        >
          Email list
        </a>
        {permission === "unsupported" ? (
          <p className="text-xs text-muted-foreground">
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
      {enrolledIds.length === 0 ? (
        <EmptyState
          title="Enrol in a comp first"
          body="Tap Enrolled on a competition. Reminders are built from those enrolments."
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Browse comps
            </Link>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No upcoming reminders"
          body="Turn on a reminder type above, or mark comps Enrolled that still have entry dates ahead."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
                {item.kind.replace(/-/g, " ")}
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
