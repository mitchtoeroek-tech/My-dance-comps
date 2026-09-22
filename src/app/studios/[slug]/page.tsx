"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkStudioPanel } from "@/components/LinkStudioPanel";
import { StudioProfileCard } from "@/components/StudioProfileCard";
import { useAuth } from "@/context/AuthContext";
import {
  fetchStudioBySlugOrId,
  isPublicStudio,
  studioPublicPath,
  type StudioRecord,
} from "@/lib/studios";

export default function StudioPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { configured, ready } = useAuth();
  const [studio, setStudio] = useState<StudioRecord | null>(null);
  const [error, setError] = useState("");
  const [loadedSlug, setLoadedSlug] = useState("");

  useEffect(() => {
    if (!configured || !ready) return;
    let cancelled = false;
    let key = slug;
    try {
      key = decodeURIComponent(slug);
    } catch {
      key = slug;
    }
    void fetchStudioBySlugOrId(key).then((result) => {
      if (cancelled) return;
      setError(result.error ?? "");
      setStudio(result.studio);
      setLoadedSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, ready, slug]);

  useEffect(() => {
    if (!studio) return;
    document.title = `${studio.name} · My Dance Comps`;
    const canonical = studioPublicPath(studio);
    if (canonical !== `/studios/${slug}`) {
      router.replace(canonical);
    }
  }, [router, slug, studio]);

  if (!configured) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Studio pages need the accounts connection.
      </p>
    );
  }

  if (!ready || (configured && loadedSlug !== slug)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading studio…
      </p>
    );
  }

  if (error || !studio) {
    return (
      <div className="space-y-3">
        <p className="font-bold">We could not find that studio.</p>
        <Link href="/studios" className="text-sm font-bold text-primary-ink underline">
          Approved studios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/studios"
        className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink"
      >
        ← Studios
      </Link>
      {!isPublicStudio(studio.status) ? (
        <p className="rounded-control bg-accent-soft px-3 py-2 text-sm font-semibold text-foreground" role="status">
          {studio.status === "rejected"
            ? "This studio was not approved, so it is not public."
            : "Awaiting approval. Only you can see this page until My Dance Comps approves the studio."}
        </p>
      ) : null}
      <StudioProfileCard studio={studio}>
        {isPublicStudio(studio.status) ? (
          <LinkStudioPanel
            studioId={studio.id}
            studioName={studio.name}
            returnPath={studioPublicPath(studio)}
          />
        ) : null}
      </StudioProfileCard>
    </div>
  );
}
