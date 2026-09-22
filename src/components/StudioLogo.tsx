"use client";

import Image from "next/image";
import { useState } from "react";
import { monogramTone, organiserInitials } from "@/lib/organiser-logo";

const TONE_CLASS = [
  "bg-primary-soft text-primary-ink",
  "bg-accent-soft text-foreground",
  "bg-[#e6f4f4] text-brand-ink",
  "bg-[#fff3e4] text-[#6b4510]",
] as const;

function studioInitials(name: string): string {
  return organiserInitials(name) || name.trim().slice(0, 1).toUpperCase() || "S";
}

/** Same size and placement as the organiser mark on a competition card. */
export function StudioLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = studioInitials(name);
  const showImage = Boolean(logoUrl) && failedUrl !== logoUrl;

  if (!showImage) {
    const tone = monogramTone(name || initials) % TONE_CLASS.length;
    return (
      <span
        className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold tracking-tight ring-1 ring-border ${TONE_CLASS[tone]}`}
        data-studio-logo={initials}
        aria-hidden="true"
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className="relative mt-0.5 flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-border"
      data-studio-logo={logoUrl}
      aria-hidden="true"
    >
      <Image
        src={logoUrl ?? ""}
        alt=""
        width={128}
        height={128}
        sizes="44px"
        className="size-11 object-contain"
        onError={() => setFailedUrl(logoUrl)}
      />
    </span>
  );
}
