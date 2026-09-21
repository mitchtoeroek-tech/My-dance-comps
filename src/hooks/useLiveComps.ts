"use client";

import { useEffect, useState } from "react";
import type { Competition } from "@/lib/types";

export function useLiveComps(initialComps: Competition[]) {
  const [comps, setComps] = useState(initialComps);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comps")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.comps) return;
        setComps(data.comps as Competition[]);
        setRefreshedAt(data.refreshedAt ?? null);
        setLive(Boolean(data.live));
      })
      .catch(() => {
        /* keep seed listings */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { comps, refreshedAt, live };
}
