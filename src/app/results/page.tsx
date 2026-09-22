"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState } from "@/components/EmptyState";
import { useFamily } from "@/context/FamilyContext";
import { getComps } from "@/lib/comps";
import { myDancersLabel } from "@/lib/copy";
import { formatShortDate } from "@/lib/datetime";
import type { CompResult } from "@/lib/types";

export default function ResultsPage() {
  const { state } = useFamily();
  const knownCompIds = useMemo(
    () => new Set(getComps().map((comp) => comp.id)),
    [],
  );
  const results = [...state.results]
    .map((result, index) => ({ result, index }))
    .sort((a, b) => {
      const byDate = b.result.date.localeCompare(a.result.date);
      return byDate !== 0 ? byDate : a.index - b.index;
    })
    .map(({ result }) => result);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Placings logged for this family. Open a dancer to add or remove one.
        </p>
      </div>
      {results.length === 0 ? (
        <EmptyState
          title="No results yet"
          body="After a competition, open a dancer and add the placing. It shows up here with their name and the comp."
          action={
            <Link
              href="/kids"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              {myDancersLabel(state.children.length)}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2" aria-label="Competition results">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              dancerName={
                state.children.find((child) => child.id === result.childId)
                  ?.name
              }
              compHref={
                result.compId && knownCompIds.has(result.compId)
                  ? `/comps/${result.compId}`
                  : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultCard({
  result,
  dancerName,
  compHref,
}: {
  result: CompResult;
  dancerName: string | undefined;
  compHref: string | null;
}) {
  const detail = [result.placing, result.score].filter(Boolean).join(" · ");

  return (
    <li className="rounded-card bg-surface p-3 ring-1 ring-border">
      <p className="text-sm font-bold text-primary-ink">
        {dancerName ? (
          <Link href={`/kids/${result.childId}`} className="underline">
            {dancerName}
          </Link>
        ) : (
          "Dancer"
        )}
      </p>
      <p className="font-bold text-foreground">
        {compHref ? (
          <Link href={compHref} className="underline">
            {result.compName}
          </Link>
        ) : (
          result.compName
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatShortDate(result.date)}
        {result.section ? ` · ${result.section}` : ""}
      </p>
      {detail ? (
        <p className="text-sm font-semibold text-primary-ink">{detail}</p>
      ) : null}
      {result.notes ? (
        <p className="mt-1 text-sm text-foreground">{result.notes}</p>
      ) : null}
    </li>
  );
}
