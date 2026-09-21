"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DateSortDir } from "@/lib/filter";
import { loadCompsDateSort, saveCompsDateSort } from "@/lib/storage";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function useCompsDateSort() {
  const sortDir = useSyncExternalStore(
    subscribe,
    loadCompsDateSort,
    () => "asc" as const,
  );

  const setSortDir = useCallback((next: DateSortDir) => {
    saveCompsDateSort(next);
    emit();
  }, []);

  return { sortDir, setSortDir };
}

const OPTIONS: { value: DateSortDir; label: string }[] = [
  { value: "asc", label: "Soonest first" },
  { value: "desc", label: "Latest first" },
];

export function DateSortControl({
  value,
  onChange,
}: {
  value: DateSortDir;
  onChange: (next: DateSortDir) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sort competitions by date"
      className="grid grid-cols-2 gap-1 rounded-control bg-muted p-1 ring-1 ring-border"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-control px-3 py-2 text-sm font-bold transition-colors ${
              selected
                ? "bg-primary text-white shadow-sm"
                : "bg-transparent text-muted-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
