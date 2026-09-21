"use client";

import { AU_STATES, DANCE_STYLES } from "@/lib/types";
import type { ChildProfile } from "@/lib/types";
import { displayAge } from "@/lib/age";
import { useFamily } from "@/context/FamilyContext";

export function ChildPicker() {
  const { state, selectedChild, setSelectedChildId } = useFamily();
  if (state.children.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => setSelectedChildId(null)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${
          !selectedChild
            ? "bg-[var(--raspberry)] text-white"
            : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
        }`}
      >
        All kids
      </button>
      {state.children.map((child) => (
        <button
          key={child.id}
          type="button"
          onClick={() => setSelectedChildId(child.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${
            selectedChild?.id === child.id
              ? "bg-[var(--raspberry)] text-white"
              : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
          }`}
        >
          {child.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

export function ChildFilterNote({ child }: { child: ChildProfile | null }) {
  if (!child) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        Add a child on the Kids tab to filter by age (as at 1 January) and
        styles. Home-state comps and nationals are shown by default.
      </p>
    );
  }
  return (
    <p className="text-sm text-[var(--ink-soft)]">
      Showing comps that fit {child.name}, {displayAge(child.dob)},{" "}
      {child.homeState} home state
      {child.styles.length ? ` · ${child.styles.join(", ")}` : ""}.
    </p>
  );
}

export function InterstateToggle() {
  const { state, setIncludeInterstate } = useFamily();
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold text-[var(--ink)] ring-1 ring-[var(--line)]">
      <span>Include interstate comps</span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--teal)]"
        checked={state.includeInterstate}
        onChange={(e) => setIncludeInterstate(e.target.checked)}
      />
    </label>
  );
}

export function StyleChecklist({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DANCE_STYLES.map((style) => {
        const on = value.includes(style);
        return (
          <button
            key={style}
            type="button"
            onClick={() =>
              onChange(
                on ? value.filter((s) => s !== style) : [...value, style],
              )
            }
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              on
                ? "bg-[var(--teal)] text-white"
                : "bg-[var(--muted)] text-[var(--ink)]"
            }`}
          >
            {style}
          </button>
        );
      })}
    </div>
  );
}

export function StateSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--ink)]"
    >
      {AU_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.name}
        </option>
      ))}
    </select>
  );
}
