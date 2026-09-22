"use client";

import { useEffect, useState } from "react";
import { normalizeCompetitions, unionCompetitions } from "@/lib/comps";
import type { Competition } from "@/lib/types";

export function useLiveComps(initialComps: Competition[]) {
  const [seeds] = useState(() => normalizeCompetitions(initialComps));
  const [comps, setComps] = useState(seeds);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comps")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.comps) return;
        const next = normalizeCompetitions(data.comps);
        if (next.length === 0) return;
        setComps(unionCompetitions(seeds, next));
        setRefreshedAt(
          typeof data.refreshedAt === "string" ? data.refreshedAt : null,
        );
        setLive(Boolean(data.live));
      })
      .catch(() => {
        /* keep seed listings */
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [seeds]);

  return { comps, refreshedAt, live, settled };
}
