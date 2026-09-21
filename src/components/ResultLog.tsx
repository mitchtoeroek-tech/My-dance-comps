"use client";

import { useMemo, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { getComps } from "@/lib/comps";
import { formatShortDate } from "@/lib/datetime";

export function ResultLog({ childId }: { childId: string }) {
  const { state, addResult, removeResult } = useFamily();
  const comps = useMemo(() => getComps(), []);
  const results = state.results.filter((r) => r.childId === childId);
  const [form, setForm] = useState({
    compId: "",
    compName: "",
    date: "",
    section: "",
    placing: "",
    score: "",
    notes: "",
  });

  return (
    <section className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
        Results log
      </h2>
      <form
        className="space-y-2 rounded-3xl bg-[var(--cream-raised)] p-4 ring-1 ring-[var(--line)]"
        onSubmit={(e) => {
          e.preventDefault();
          const picked = comps.find((c) => c.id === form.compId);
          addResult({
            childId,
            compId: form.compId || null,
            compName: form.compName.trim() || picked?.name || "Competition",
            date: form.date || new Date().toISOString().slice(0, 10),
            section: form.section.trim(),
            placing: form.placing.trim(),
            score: form.score.trim(),
            notes: form.notes.trim(),
          });
          setForm({
            compId: "",
            compName: "",
            date: "",
            section: "",
            placing: "",
            score: "",
            notes: "",
          });
        }}
      >
        <label className="block text-sm font-bold">
          Competition
          <select
            value={form.compId}
            onChange={(e) => setForm({ ...form, compId: e.target.value })}
            className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Other / not listed</option>
            {comps.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
        </label>
        {!form.compId ? (
          <input
            value={form.compName}
            onChange={(e) => setForm({ ...form, compName: e.target.value })}
            placeholder="Competition name"
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <input
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
            placeholder="Section e.g. Jazz 8/U"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <input
            value={form.placing}
            onChange={(e) => setForm({ ...form, placing: e.target.value })}
            placeholder="Placing"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <input
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
            placeholder="Score / crit"
            className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes for next time"
          rows={2}
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white"
        >
          Add result
        </button>
      </form>
      {results.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">
          No results yet. Pop in placings after the weekend so you remember the
          highlights.
        </p>
      ) : (
        <ul className="space-y-2">
          {results.map((result) => (
            <li
              key={result.id}
              className="rounded-2xl bg-white p-3 ring-1 ring-[var(--line)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-[var(--ink)]">{result.compName}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {formatShortDate(result.date)}
                    {result.section ? ` · ${result.section}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-[var(--raspberry)]">
                    {[result.placing, result.score].filter(Boolean).join(" · ")}
                  </p>
                  {result.notes ? (
                    <p className="mt-1 text-sm text-[var(--ink)]">{result.notes}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeResult(result.id)}
                  className="text-xs font-bold text-[var(--ink-soft)]"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
