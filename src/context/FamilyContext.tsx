"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { getComps } from "@/lib/comps";
import {
  buildReminders,
  dueReminders,
  upcomingReminders,
} from "@/lib/reminders";
import {
  defaultFamilyState,
  loadFamilyState,
  newId,
  saveFamilyState,
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

function write(next: FamilyState) {
  memory = next;
  hydrated = true;
  saveFamilyState(next);
  emit();
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
  toggleFavourite: (compId: string) => void;
  isFavourite: (compId: string) => boolean;
  toggleEnrolled: (compId: string) => void;
  isEnrolled: (compId: string) => boolean;
  setReminderPrefs: (prefs: ReminderPrefs) => void;
  addResult: (result: Omit<CompResult, "id">) => void;
  removeResult: (id: string) => void;
  markNotified: (ids: string[]) => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
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

  const selectedChild = useMemo(() => {
    if (!Array.isArray(state.children)) return null;
    return state.children.find((c) => c.id === state.selectedChildId) ?? null;
  }, [state.children, state.selectedChildId]);

  const setSelectedChildId = useCallback((id: string | null) => {
    patch((prev) => {
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
            c.id === child.id ? { ...c, ...child, id: child.id } : c,
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
      };
    });
  }, []);

  const toggleFavourite = useCallback((compId: string) => {
    patch((prev) => {
      const has = prev.favourites.includes(compId);
      return {
        ...prev,
        favourites: has
          ? prev.favourites.filter((id) => id !== compId)
          : [...prev.favourites, compId],
      };
    });
  }, []);

  const isFavourite = useCallback(
    (compId: string) => state.favourites.includes(compId),
    [state.favourites],
  );

  const toggleEnrolled = useCallback((compId: string) => {
    patch((prev) => {
      const enrolled = Array.isArray(prev.enrolled) ? prev.enrolled : [];
      const has = enrolled.includes(compId);
      return {
        ...prev,
        enrolled: has
          ? enrolled.filter((id) => id !== compId)
          : [...enrolled, compId],
      };
    });
  }, []);

  const isEnrolled = useCallback(
    (compId: string) =>
      Array.isArray(state.enrolled) && state.enrolled.includes(compId),
    [state.enrolled],
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
        const items = upcomingReminders(
          buildReminders(comps, state.reminderPrefs, state.favourites),
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
    state.favourites,
    state.reminderPrefs,
    state.notifiedReminderIds,
    markNotified,
  ]);

  const childrenCount = Array.isArray(state.children)
    ? state.children.length
    : 0;

  const value: FamilyContextValue = {
    ready,
    state,
    selectedChild,
    canAddChild: childrenCount < SOFT_MAX_KIDS,
    setSelectedChildId,
    setIncludeInterstate,
    setPreferredState,
    upsertChild,
    removeChild,
    toggleFavourite,
    isFavourite,
    toggleEnrolled,
    isEnrolled,
    setReminderPrefs,
    addResult,
    removeResult,
    markNotified,
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
