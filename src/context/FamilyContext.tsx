"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getComps } from "@/lib/comps";
import {
  buildReminders,
  dueReminders,
  upcomingReminders,
} from "@/lib/reminders";
import { useAuth } from "@/context/AuthContext";
import {
  pullDancerLinkedState,
  pullFamilyState,
  pushDancerLinkedState,
  pushFamilyState,
  reconcileDancerLinkedState,
  reconcileFamilyState,
  scopeDancerFamily,
  type DancerFamilyMode,
} from "@/lib/family-sync";
import {
  dropChildEnrollment,
  enrolledIdsForChild,
  isCompEnrolled,
  toggleEnrollment,
} from "@/lib/enrolled";
import {
  defaultFamilyState,
  loadFamilyState,
  loadLastOwnerId,
  newId,
  saveFamilyState,
  saveLastOwnerId,
  SOFT_MAX_KIDS,
} from "@/lib/storage";
import type {
  AuStateCode,
  ChildProfile,
  CompResult,
  FamilyState,
  ReminderPrefs,
} from "@/lib/types";

let memory: FamilyState = defaultFamilyState;
let hydrated = false;
let cloudUserId: string | null = null;
let cloudMode: "owner" | "dancer-linked" = "owner";
let dancerMode: DancerFamilyMode | null = null;
let acceptCloudPushes = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedJson = "";
const listeners = new Set<() => void>();

function snapshot(): FamilyState {
  return memory;
}

function getServerSnapshot(): FamilyState {
  return defaultFamilyState;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function scheduleCloudPush(state: FamilyState) {
  if (!cloudUserId || !acceptCloudPushes) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const userId = cloudUserId;
    if (!userId) return;
    const mode = cloudMode;
    const json = JSON.stringify(state);
    if (json === lastPushedJson) return;
    lastPushedJson = json;
    const push =
      mode === "dancer-linked"
        ? pushDancerLinkedState(state)
        : pushFamilyState(userId, state);
    void push.catch(() => {
      lastPushedJson = "";
    });
  }, 600);
}

function write(next: FamilyState) {
  const scoped = scopeDancerFamily(next, dancerMode);
  memory = scoped;
  hydrated = true;
  saveFamilyState(scoped);
  emit();
  scheduleCloudPush(scoped);
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  memory = loadFamilyState();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function patch(updater: (prev: FamilyState) => FamilyState) {
  write(updater(snapshot()));
}

interface FamilyContextValue {
  ready: boolean;
  state: FamilyState;
  selectedChild: ChildProfile | null;
  canAddChild: boolean;
  setSelectedChildId: (id: string | null) => void;
  setIncludeInterstate: (value: boolean) => void;
  setPreferredState: (value: AuStateCode) => void;
  upsertChild: (child: Omit<ChildProfile, "id"> & { id?: string }) => string;
  removeChild: (id: string) => void;
  /**
   * Toggle Enrolled. Omit `childId` to use the selected dancer.
   * Pass `null` for Everyone / All dancers (family-wide).
   */
  toggleEnrolled: (compId: string, childId?: string | null) => void;
  isEnrolled: (compId: string, childId?: string | null) => boolean;
  enrolledIdsFor: (childId?: string | null) => string[];
  setReminderPrefs: (prefs: ReminderPrefs) => void;
  addResult: (result: Omit<CompResult, "id">) => void;
  removeResult: (id: string) => void;
  markNotified: (ids: string[]) => void;
  /** Pull family data again after a family link, invite, or unlink. */
  refreshCloud: () => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady, account, accountReady } = useAuth();
  const userId = user?.id ?? null;
  const [cloudGeneration, setCloudGeneration] = useState(0);
  const refreshCloud = useCallback(() => {
    setCloudGeneration((value) => value + 1);
  }, []);
  const linkedChildId = account?.linkedChildId ?? null;
  const accountRole = account?.role ?? "parent";
  const state = useSyncExternalStore(
    subscribe,
    snapshot,
    getServerSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    dancerMode =
      userId && accountReady
        ? { role: accountRole, linkedChildId }
        : null;
    if (!hydrated || dancerMode?.role !== "dancer") return;
    const scoped = scopeDancerFamily(memory, dancerMode);
    if (scoped === memory) return;
    acceptCloudPushes = false;
    memory = scoped;
    saveFamilyState(scoped);
    emit();
  }, [authReady, userId, accountReady, accountRole, linkedChildId]);

  useEffect(() => {
    if (!authReady || !hydrated || !accountReady) return;
    if (!userId) {
      cloudUserId = null;
      cloudMode = "owner";
      dancerMode = null;
      acceptCloudPushes = false;
      lastPushedJson = "";
      return;
    }

    let cancelled = false;
    cloudUserId = userId;
    acceptCloudPushes = false;
    const linked = accountRole === "dancer" && Boolean(linkedChildId);
    cloudMode = linked ? "dancer-linked" : "owner";
    dancerMode = { role: accountRole, linkedChildId };

    void (async () => {
      try {
        const remote = linked
          ? (await pullDancerLinkedState()).state
          : await pullFamilyState(userId);
        if (cancelled) return;
        const next = linked
          ? reconcileDancerLinkedState(snapshot(), remote)
          : reconcileFamilyState(
              snapshot(),
              remote,
              loadLastOwnerId(),
              userId,
            );
        saveLastOwnerId(userId);
        acceptCloudPushes = true;
        write(next);
      } catch {
        if (cancelled) return;
        saveLastOwnerId(userId);
        acceptCloudPushes = true;
        scheduleCloudPush(snapshot());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    accountReady,
    userId,
    ready,
    accountRole,
    linkedChildId,
    cloudGeneration,
  ]);

  const selectedChild = useMemo(() => {
    if (!Array.isArray(state.children)) return null;
    return state.children.find((c) => c.id === state.selectedChildId) ?? null;
  }, [state.children, state.selectedChildId]);

  const setSelectedChildId = useCallback((id: string | null) => {
    patch((prev) => {
      if (dancerMode?.role === "dancer") {
        const only = dancerMode.linkedChildId
          ? prev.children.find((child) => child.id === dancerMode?.linkedChildId)
          : prev.children.find((child) => child.id === prev.selectedChildId) ??
            prev.children[0];
        if (!only) return prev;
        return {
          ...prev,
          selectedChildId: only.id,
          preferredState: only.homeState ?? prev.preferredState,
        };
      }
      const child = Array.isArray(prev.children)
        ? prev.children.find((c) => c.id === id)
        : undefined;
      return {
        ...prev,
        selectedChildId: id,
        preferredState: child?.homeState ?? prev.preferredState,
      };
    });
  }, []);

  const setIncludeInterstate = useCallback((value: boolean) => {
    patch((prev) => ({ ...prev, includeInterstate: value }));
  }, []);

  const setPreferredState = useCallback((value: AuStateCode) => {
    patch((prev) => ({ ...prev, preferredState: value }));
  }, []);

  const upsertChild = useCallback(
    (child: Omit<ChildProfile, "id"> & { id?: string }) => {
      if (child.id) {
        patch((prev) => ({
          ...prev,
          children: prev.children.map((c) =>
            c.id === child.id
              ? {
                  ...c,
                  ...child,
                  id: child.id,
                  linkedUserId: child.linkedUserId ?? c.linkedUserId,
                }
              : c,
          ),
          preferredState:
            prev.selectedChildId === child.id || !prev.preferredState
              ? child.homeState
              : prev.preferredState,
        }));
        return child.id;
      }
      const id = newId();
      patch((prev) => {
        if (dancerMode?.role === "dancer") {
          if (dancerMode.linkedChildId || prev.children.length >= 1) return prev;
        }
        if (prev.children.length >= SOFT_MAX_KIDS) return prev;
        return {
          ...prev,
          children: [...prev.children, { ...child, id }],
          selectedChildId: prev.selectedChildId ?? id,
          preferredState: prev.preferredState ?? child.homeState,
        };
      });
      return id;
    },
    [],
  );

  const removeChild = useCallback((id: string) => {
    patch((prev) => {
      if (dancerMode?.role === "dancer" && dancerMode.linkedChildId) {
        return prev;
      }
      const children = prev.children.filter((c) => c.id !== id);
      const selectedChildId =
        prev.selectedChildId === id
          ? (children[0]?.id ?? null)
          : prev.selectedChildId;
      const selected = children.find((c) => c.id === selectedChildId);
      return {
        ...prev,
        children,
        selectedChildId,
        preferredState:
          selected?.homeState ?? children[0]?.homeState ?? prev.preferredState,
        results: prev.results.filter((r) => r.childId !== id),
        enrolledByChild: dropChildEnrollment(prev.enrolledByChild, id),
      };
    });
  }, []);

  const toggleEnrolled = useCallback(
    (compId: string, childId?: string | null) => {
      patch((prev) => {
        const target = childId === undefined ? prev.selectedChildId : childId;
        const next = toggleEnrollment(
          prev.enrolled,
          prev.enrolledByChild,
          compId,
          target,
        );
        return { ...prev, ...next };
      });
    },
    [],
  );

  const isEnrolled = useCallback(
    (compId: string, childId?: string | null) => {
      const target = childId === undefined ? state.selectedChildId : childId;
      return isCompEnrolled(
        state.enrolled,
        state.enrolledByChild,
        compId,
        target,
      );
    },
    [state.enrolled, state.enrolledByChild, state.selectedChildId],
  );

  const enrolledIdsFor = useCallback(
    (childId?: string | null) => {
      const target = childId === undefined ? state.selectedChildId : childId;
      return enrolledIdsForChild(
        state.enrolled,
        state.enrolledByChild,
        target,
      );
    },
    [state.enrolled, state.enrolledByChild, state.selectedChildId],
  );

  const setReminderPrefs = useCallback((prefs: ReminderPrefs) => {
    patch((prev) => ({ ...prev, reminderPrefs: prefs }));
  }, []);

  const addResult = useCallback((result: Omit<CompResult, "id">) => {
    patch((prev) => ({
      ...prev,
      results: [{ ...result, id: newId() }, ...prev.results],
    }));
  }, []);

  const removeResult = useCallback((id: string) => {
    patch((prev) => ({
      ...prev,
      results: prev.results.filter((r) => r.id !== id),
    }));
  }, []);

  const markNotified = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    patch((prev) => ({
      ...prev,
      notifiedReminderIds: Array.from(
        new Set([...prev.notifiedReminderIds, ...ids]),
      ),
    }));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const tick = () => {
      try {
        const comps = getComps();
        const enrolledIds = enrolledIdsForChild(
          state.enrolled,
          state.enrolledByChild,
          null,
        );
        const items = upcomingReminders(
          buildReminders(comps, state.reminderPrefs, enrolledIds),
        );
        const due = dueReminders(items, state.notifiedReminderIds);
        if (due.length === 0) return;
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
        markNotified(due.map((d) => d.id));
      } catch {
        /* never let reminder ticks crash the tree */
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [
    ready,
    state.enrolled,
    state.enrolledByChild,
    state.reminderPrefs,
    state.notifiedReminderIds,
    markNotified,
  ]);

  const childrenCount = Array.isArray(state.children)
    ? state.children.length
    : 0;
  const dancerAccount = accountRole === "dancer" && accountReady && Boolean(userId);
  const canAddChild = dancerAccount
    ? !linkedChildId && childrenCount === 0
    : childrenCount < SOFT_MAX_KIDS;

  const value: FamilyContextValue = {
    ready,
    state,
    selectedChild,
    canAddChild,
    setSelectedChildId,
    setIncludeInterstate,
    setPreferredState,
    upsertChild,
    removeChild,
    toggleEnrolled,
    isEnrolled,
    enrolledIdsFor,
    setReminderPrefs,
    addResult,
    removeResult,
    markNotified,
    refreshCloud,
  };

  return (
    <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}
