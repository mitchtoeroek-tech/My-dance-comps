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
        className={`min-h-11 shrink-0 rounded-control px-3 py-1.5 text-sm font-bold ${
          !selectedChild
            ? "bg-primary text-white"
            : "bg-surface text-foreground ring-1 ring-border"
        }`}
      >
        Everyone
      </button>
      {state.children.map((child) => (
        <button
          key={child.id}
          type="button"
          onClick={() => setSelectedChildId(child.id)}
          className={`min-h-11 shrink-0 rounded-control px-3 py-1.5 text-sm font-bold ${
            selectedChild?.id === child.id
              ? "bg-primary text-white"
              : "bg-surface text-foreground ring-1 ring-border"
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
      <p className="mb-2 text-sm font-bold text-foreground">Home state</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {AU_STATES.map((state) => {
          const on = value === state.code;
          return (
            <button
              key={state.code}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(state.code)}
              className={`min-h-11 shrink-0 rounded-control px-3 py-1.5 text-sm font-bold ${
                on
                  ? "bg-primary text-white"
                  : "bg-surface text-foreground ring-1 ring-border"
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
      <p className="text-sm text-muted-foreground">
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
      <p className="text-sm text-muted-foreground">
        Showing {child.homeState} comps and National finals that fit{" "}
        {child.name}, {displayAge(child.dob)}
        {child.styles?.length ? ` · ${child.styles.join(", ")}` : ""}.
      </p>
    );
  }

  if (homeState) {
    return (
      <p className="text-sm text-muted-foreground">
        Showing {homeState} comps and National finals. Select a dancer to also
        filter by age (as at 1 January) and styles.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
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
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-card px-4 py-3.5 text-left shadow-card ring-2 transition ${
        on ? "bg-primary-soft ring-primary" : "bg-surface ring-border"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">
          Include interstate comps
        </span>
        <span className="mt-0.5 block text-xs font-medium leading-5 text-muted-foreground">
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
          on ? "bg-primary" : "bg-muted"
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
            className={`min-h-11 rounded-control px-2.5 py-1 text-xs font-bold ${
              on
                ? "bg-primary text-white"
                : "bg-muted text-foreground"
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
      className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground"
    >
      {AU_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.name}
        </option>
      ))}
    </select>
  );
}
