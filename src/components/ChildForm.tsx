"use client";

import { useState } from "react";
import type { AuStateCode, ChildProfile, DanceStyle } from "@/lib/types";
import { StyleChecklist, StateSelect } from "./ChildPicker";
import { StudioLinkField } from "./StudioLinkField";

const empty = {
  name: "",
  dob: "",
  styles: [] as DanceStyle[],
  studio: "",
  studioId: null as string | null,
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
          styles: initial.styles ?? [],
          studio: initial.studio,
          studioId: initial.studioId ?? null,
          homeState: initial.homeState,
        }
      : empty,
  );
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-border"
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
          studioId: form.studioId,
          homeState: form.homeState,
        });
        if (!initial) setForm(empty);
        setError("");
      }}
    >
      <label className="block text-sm font-bold text-foreground">
        Name
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
          placeholder="e.g. Mia"
        />
      </label>
      <label className="block text-sm font-bold text-foreground">
        Date of birth
        <input
          required
          type="date"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm font-medium"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Age for comps is calculated as at 1 January of the competition year.
      </p>
      <label className="block text-sm font-bold text-foreground">
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
      <StudioLinkField
        studioId={form.studioId}
        studioName={form.studio}
        onChange={({ studioId, studioName }) =>
          setForm({ ...form, studioId, studio: studioName })
        }
      />
      <div>
        <p className="mb-2 text-sm font-bold text-foreground">
          Preferred styles
        </p>
        <StyleChecklist
          value={form.styles}
          onChange={(styles) =>
            setForm({ ...form, styles: styles as DanceStyle[] })
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Leave blank to match every style.
        </p>
      </div>
      {error ? (
        <p className="text-sm font-semibold text-primary-ink">{error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-control bg-surface px-4 py-2 text-sm font-bold text-foreground ring-1 ring-border"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
