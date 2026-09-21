"use client";

import { useCallback, useSyncExternalStore } from "react";
import { STATUS_FILTER_OPTIONS } from "@/lib/comps";
import { loadCompsStatusFilter, saveCompsStatusFilter } from "@/lib/storage";
import type { RegistrationStatus } from "@/lib/types";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function useCompsStatusFilter() {
  const statuses = useSyncExternalStore(
    subscribe,
    loadCompsStatusFilter,
    loadCompsStatusFilter,
  );

  const setStatuses = useCallback((next: RegistrationStatus[]) => {
    saveCompsStatusFilter(next);
    emit();
  }, []);

  return { statuses, setStatuses };
}

const SELECTED: Record<RegistrationStatus, string> = {
  open: "bg-status-open text-status-open-ink",
  "opens-soon": "bg-status-opening text-status-opening-ink",
  "closing-soon": "bg-status-closing text-status-closing-ink",
  closed: "bg-status-closed text-status-closed-ink",
  unknown: "bg-status-unknown text-status-unknown-ink",
};

export function StatusFilterControl({
  value,
  onChange,
}: {
  value: RegistrationStatus[];
  onChange: (next: RegistrationStatus[]) => void;
}) {
  const allSelected = value.length === 0;

  function toggle(status: RegistrationStatus) {
    if (value.includes(status)) {
      onChange(value.filter((item) => item !== status));
      return;
    }
    onChange([...value, status]);
  }

  return (
    <div
      role="group"
      aria-label="Filter by registration status"
      className="flex flex-wrap gap-1.5"
    >
      <button
        type="button"
        aria-pressed={allSelected}
        onClick={() => onChange([])}
        className={`min-h-11 rounded-control px-3 py-1.5 text-xs font-bold ${
          allSelected
            ? "bg-primary text-white"
            : "bg-surface text-foreground ring-1 ring-border"
        }`}
      >
        All
      </button>
      {STATUS_FILTER_OPTIONS.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={`min-h-11 rounded-control px-3 py-1.5 text-xs font-bold ${
              selected
                ? SELECTED[option.value]
                : "bg-surface text-foreground ring-1 ring-border"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
