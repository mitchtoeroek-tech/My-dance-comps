"use client";

import { useState } from "react";
import type { AuStateCode, ChildProfile, DanceStyle } from "@/lib/types";
import { StyleChecklist, StateSelect } from "./ChildPicker";

const empty = {
  name: "",
  dob: "",
  styles: [] as DanceStyle[],
  studio: "",
  homeState: "SA" as AuStateCode,
};

export function ChildForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save dancer",
}: {
  initial?: ChildProfile;
  onSubmit: (child: Omit<ChildProfile, "id"> & { id?: string }) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          dob: initial.dob,
          styles: initial.styles,
          studio: initial.studio,
          homeState: initial.homeState,
        }
      : empty,
  );
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-3 rounded-3xl bg-[var(--cream-raised)] p-4 ring-1 ring-[var(--line)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.dob) {
          setError("Please add a name and date of birth.");
          return;
        }
        onSubmit({
          id: initial?.id,
          name: form.name.trim(),
          dob: form.dob,
          styles: form.styles,
          studio: form.studio.trim(),
          homeState: form.homeState,
        });
        if (!initial) setForm(empty);
        setError("");
      }}
    >
      <label className="block text-sm font-bold text-[var(--ink)]">
        Name
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium"
          placeholder="e.g. Mia"
        />
      </label>
      <label className="block text-sm font-bold text-[var(--ink)]">
        Date of birth
        <input
          required
          type="date"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium"
        />
      </label>
      <p className="text-xs text-[var(--ink-soft)]">
        Age for comps is calculated as at 1 January of the competition year.
      </p>
      <label className="block text-sm font-bold text-[var(--ink)]">
        Home state
        <div className="mt-1">
          <StateSelect
            value={form.homeState}
            onChange={(homeState) =>
              setForm({ ...form, homeState: homeState as AuStateCode })
            }
          />
        </div>
      </label>
      <label className="block text-sm font-bold text-[var(--ink)]">
        Dance studio
        <input
          value={form.studio}
          onChange={(e) => setForm({ ...form, studio: e.target.value })}
          className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium"
          placeholder="Optional"
        />
      </label>
      <div>
        <p className="mb-2 text-sm font-bold text-[var(--ink)]">
          Preferred styles
        </p>
        <StyleChecklist
          value={form.styles}
          onChange={(styles) =>
            setForm({ ...form, styles: styles as DanceStyle[] })
          }
        />
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Leave blank to match every style.
        </p>
      </div>
      {error ? (
        <p className="text-sm font-semibold text-[var(--raspberry)]">{error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--ink)] ring-1 ring-[var(--line)]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
