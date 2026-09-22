"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { useLiveComps } from "@/hooks/useLiveComps";
import { getComps } from "@/lib/comps";
import {
  getReminderWatch,
  getServerReminderWatch,
  isReminderWatchReady,
  publishReminderCatalogue,
  subscribeReminderWatch,
} from "@/lib/reminder-watch";
import {
  buildReminders,
  dueReminders,
  inAppReminders,
} from "@/lib/reminders";
import type { ReminderItem } from "@/lib/types";

interface ReminderEngineValue {
  /** False until the listings watermark has been applied for this visit. */
  ready: boolean;
  items: ReminderItem[];
  /** True only when Resend and a from-address are configured on the server. */
  emailConfigured: boolean;
}

const ReminderEngineContext = createContext<ReminderEngineValue | null>(null);

export function ReminderEngine({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { state, ready: familyReady, markNotified } = useFamily();
  const { comps, live, settled } = useLiveComps(getComps());
  const watch = useSyncExternalStore(
    subscribeReminderWatch,
    getReminderWatch,
    getServerReminderWatch,
  );
  const watchReady = useSyncExternalStore(
    subscribeReminderWatch,
    isReminderWatchReady,
    () => false,
  );
  const [emailConfigured, setEmailConfigured] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reminders/email")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setEmailConfigured(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setEmailConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settled) return;
    publishReminderCatalogue(comps, live ? "live" : "seed");
  }, [settled, live, comps]);

  const items = useMemo(() => {
    if (!watchReady || !familyReady) return [];
    const now = new Date();
    return inAppReminders(
      buildReminders(
        comps,
        state.reminderPrefs,
        {
          children: state.children,
          includeInterstate: state.includeInterstate,
          baselinedAt: watch.baselinedAt,
          announcedAt: watch.announcedAt,
          openedAt: watch.openedAt,
        },
        now,
      ),
      now,
    );
  }, [
    watchReady,
    familyReady,
    comps,
    state.reminderPrefs,
    state.children,
    state.includeInterstate,
    watch.baselinedAt,
    watch.announcedAt,
    watch.openedAt,
  ]);

  useEffect(() => {
    if (!familyReady || !watchReady) return;
    if (typeof window === "undefined") return;

    const tick = async () => {
      if (sending.current) return;
      const canBrowser =
        "Notification" in window && Notification.permission === "granted";
      const token = session?.access_token ?? "";
      const canEmail =
        state.reminderPrefs.emailEnabled && emailConfigured && Boolean(token);
      if (!canBrowser && !canEmail) return;

      const due = dueReminders(items, state.notifiedReminderIds);
      if (due.length === 0) return;

      sending.current = true;
      let delivered = false;
      try {
        if (canBrowser) {
          due.forEach((item) => {
            try {
              new Notification("My Dance Comps", {
                body: item.label,
                tag: item.id,
              });
            } catch {
              /* ignore */
            }
          });
          delivered = true;
        }
        if (canEmail) {
          const res = await fetch("/api/reminders/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items: due }),
          });
          const data = (await res.json().catch(() => null)) as {
            sent?: boolean;
          } | null;
          if (data?.sent) delivered = true;
        }
        if (delivered) markNotified(due.map((item) => item.id));
      } catch {
        /* in-app list still shows the reminders */
      } finally {
        sending.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [
    familyReady,
    watchReady,
    items,
    state.notifiedReminderIds,
    state.reminderPrefs.emailEnabled,
    emailConfigured,
    session?.access_token,
    markNotified,
  ]);

  const value = useMemo<ReminderEngineValue>(
    () => ({
      ready: watchReady && familyReady,
      items,
      emailConfigured,
    }),
    [watchReady, familyReady, items, emailConfigured],
  );

  return (
    <ReminderEngineContext.Provider value={value}>
      {children}
    </ReminderEngineContext.Provider>
  );
}

export function useReminderEngine() {
  const ctx = useContext(ReminderEngineContext);
  if (!ctx) {
    throw new Error("useReminderEngine must be used within ReminderEngine");
  }
  return ctx;
}
