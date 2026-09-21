"use client";

import { AU_STATES, DANCE_STYLES } from "@/lib/types";
import type { AuStateCode, ChildProfile } from "@/lib/types";
import { displayAge } from "@/lib/age";
import { useFamily } from "@/context/FamilyContext";

export function ChildPicker() {
  const { state, selectedChild, setSelectedChildId } = useFamily();
  if (!Array.isArray(state.children) || state.children.length === 0) return null;

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
        Everyone
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
          {(child.name || "Dancer").split(" ")[0]}
        </button>
      ))}
    </div>
  );
}

export function HomeStateChips({
  value,
  onChange,
}: {
  value: AuStateCode | null;
  onChange: (value: AuStateCode) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold text-[var(--ink)]">Home state</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {AU_STATES.map((state) => {
          const on = value === state.code;
          return (
            <button
              key={state.code}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(state.code)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${
                on
                  ? "bg-[var(--teal)] text-white"
                  : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
              }`}
            >
              {state.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChildFilterNote({
  child,
  homeState,
  includeInterstate,
}: {
  child: ChildProfile | null;
  homeState: AuStateCode | null;
  includeInterstate: boolean;
}) {
  if (includeInterstate) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        {child
          ? `Showing comps that fit ${child.name}, ${displayAge(child.dob)}${
              child.styles?.length ? ` · ${child.styles.join(", ")}` : ""
            }, including interstate events.`
          : "Showing competitions from every Australian state. Turn off interstate to keep the list to one home state plus National finals."}
      </p>
    );
  }

  if (child) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        Showing {child.homeState} comps and National finals that fit{" "}
        {child.name}, {displayAge(child.dob)}
        {child.styles?.length ? ` · ${child.styles.join(", ")}` : ""}.
      </p>
    );
  }

  if (homeState) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        Showing {homeState} comps and National finals. Select a dancer to also
        filter by age (as at 1 January) and styles.
      </p>
    );
  }

  return (
    <p className="text-sm text-[var(--ink-soft)]">
      Pick a home state or add a dancer. The main list stays local until you
      include interstate comps.
    </p>
  );
}

export function InterstateToggle({
  homeState,
}: {
  homeState: AuStateCode | null;
}) {
  const { state, setIncludeInterstate } = useFamily();
  const on = state.includeInterstate;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Include interstate comps"
      onClick={() => setIncludeInterstate(!on)}
      className={`flex w-full items-center justify-between gap-3 rounded-3xl px-4 py-3.5 text-left shadow-[0_8px_24px_-18px_rgba(90,30,50,0.45)] ring-2 transition ${
        on
          ? "bg-[var(--teal-soft)] ring-[var(--teal)]"
          : "bg-white ring-[var(--raspberry)]"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-[var(--ink)]">
          Include interstate comps
        </span>
        <span className="mt-0.5 block text-xs font-medium leading-5 text-[var(--ink-soft)]">
          {on
            ? "On — comps from every Australian state are listed."
            : homeState
              ? `Off — only ${homeState} comps and National finals.`
              : "Off — pick a home state, or turn this on to see every state."}
        </span>
      </span>
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          on ? "bg-[var(--teal)]" : "bg-[var(--muted)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
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
