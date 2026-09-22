"use client";

import { useEffect, useState } from "react";
import {
  fetchApprovedStudioMarks,
  parseStudioId,
  type ApprovedStudioMark,
} from "@/lib/studios";

export function studioMarkFor(
  marks: Record<string, ApprovedStudioMark>,
  studioId: string | null | undefined,
): ApprovedStudioMark | null {
  const id = parseStudioId(studioId ?? null);
  if (!id) return null;
  return marks[id] ?? null;
}

/** One lookup for every linked studio on the page. Typed names are ignored. */
export function useApprovedStudioMarks(
  ids: ReadonlyArray<string | null | undefined>,
): Record<string, ApprovedStudioMark> {
  const key = Array.from(
    new Set(
      ids.flatMap((id) => {
        const parsed = parseStudioId(id ?? null);
        return parsed ? [parsed] : [];
      }),
    ),
  )
    .sort()
    .join(",");

  const [marks, setMarks] = useState<Record<string, ApprovedStudioMark>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void fetchApprovedStudioMarks(key.split(",")).then((rows) => {
      if (cancelled) return;
      const next: Record<string, ApprovedStudioMark> = {};
      for (const row of rows) next[row.id] = row;
      setMarks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return {};
  return marks;
}
