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
  ChildProfile,
  CompResult,
  FamilyState,
  ReminderPrefs,
} from "@/lib/types";

let memory: FamilyState | null = null;
const listeners = new Set<() => void>();

function snapshot(): FamilyState {
  if (!memory) memory = loadFamilyState();
  return memory;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function write(next: FamilyState) {
  memory = next;
  saveFamilyState(next);
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
  upsertChild: (child: Omit<ChildProfile, "id"> & { id?: string }) => string;
  removeChild: (id: string) => void;
  toggleFavourite: (compId: string) => void;
  isFavourite: (compId: string) => boolean;
  setReminderPrefs: (prefs: ReminderPrefs) => void;
  addResult: (result: Omit<CompResult, "id">) => void;
  removeResult: (id: string) => void;
  markNotified: (ids: string[]) => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => defaultFamilyState);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const selectedChild = useMemo(
    () => state.children.find((c) => c.id === state.selectedChildId) ?? null,
    [state.children, state.selectedChildId],
  );

  const setSelectedChildId = useCallback((id: string | null) => {
    patch((prev) => ({ ...prev, selectedChildId: id }));
  }, []);

  const setIncludeInterstate = useCallback((value: boolean) => {
    patch((prev) => ({ ...prev, includeInterstate: value }));
  }, []);

  const upsertChild = useCallback(
    (child: Omit<ChildProfile, "id"> & { id?: string }) => {
      if (child.id) {
        patch((prev) => ({
          ...prev,
          children: prev.children.map((c) =>
            c.id === child.id ? { ...c, ...child, id: child.id } : c,
          ),
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
        };
      });
      return id;
    },
    [],
  );

  const removeChild = useCallback((id: string) => {
    patch((prev) => {
      const children = prev.children.filter((c) => c.id !== id);
      return {
        ...prev,
        children,
        selectedChildId:
          prev.selectedChildId === id
            ? (children[0]?.id ?? null)
            : prev.selectedChildId,
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

  const value: FamilyContextValue = {
    ready,
    state,
    selectedChild,
    canAddChild: state.children.length < SOFT_MAX_KIDS,
    setSelectedChildId,
    setIncludeInterstate,
    upsertChild,
    removeChild,
    toggleFavourite,
    isFavourite,
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
