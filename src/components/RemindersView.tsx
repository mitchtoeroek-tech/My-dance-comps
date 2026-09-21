"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useFamily } from "@/context/FamilyContext";
import { getComps } from "@/lib/comps";
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
  const items = useMemo(
    () =>
      upcomingReminders(
        buildReminders(comps, state.reminderPrefs, state.favourites),
      ),
    [comps, state.favourites, state.reminderPrefs],
  );

  const prefs = state.reminderPrefs;

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Reminders
      </h1>
      <p className="text-sm leading-6 text-[var(--ink-soft)]">
        Nudges for saved comps, using Australia/Adelaide time. No paid
        notification service — browser alerts only work while this site is open
        (or installed) after you allow them.
      </p>
      <section className="space-y-2 rounded-3xl bg-[var(--cream-raised)] p-4 ring-1 ring-[var(--line)]">
        <h2 className="font-extrabold text-[var(--ink)]">When to remind me</h2>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          When entries open
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--raspberry)]"
            checked={prefs.onOpen}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, onOpen: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          1 week before entries close
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--raspberry)]"
            checked={prefs.weekBeforeClose}
            onChange={(e) =>
              setReminderPrefs({ ...prefs, weekBeforeClose: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          1 day before entries close
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--raspberry)]"
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
          className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Download .ics
        </button>
        <a
          href={items.length ? mailtoReminders(items) : undefined}
          className={`rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-[var(--line)] ${
            items.length ? "text-[var(--ink)]" : "pointer-events-none opacity-50"
          }`}
        >
          Email list
        </a>
        {permission === "unsupported" ? (
          <p className="text-xs text-[var(--ink-soft)]">
            This browser does not support notifications.
          </p>
        ) : permission === "granted" ? (
          <p className="self-center text-xs font-semibold text-[var(--teal)]">
            Browser notifications on
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const result = await Notification.requestPermission();
              setRequested(result);
            }}
            className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[var(--gold-ink)]"
          >
            Allow browser notifications
          </button>
        )}
      </div>
      {state.favourites.length === 0 ? (
        <EmptyState
          title="Save a comp first"
          body="Star a competition on the Comps or Saved tab. Reminders are built from those favourites."
          action={
            <Link
              href="/"
              className="inline-flex rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
            >
              Browse comps
            </Link>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No upcoming reminders"
          body="Turn on a reminder type above, or save comps that still have entry dates ahead."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-3xl bg-white p-4 ring-1 ring-[var(--line)]"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--raspberry)]">
                {item.kind.replace(/-/g, " ")}
              </p>
              <p className="font-extrabold text-[var(--ink)]">{item.label}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {formatDateTime(item.fireAt)}
              </p>
              <p className="mt-1 text-sm leading-6">{item.detail}</p>
              <Link
                href={`/comps/${item.compId}`}
                className="mt-2 inline-block text-sm font-bold text-[var(--teal)]"
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
