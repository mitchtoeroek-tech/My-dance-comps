import Image from "next/image";
import { organiserMark } from "@/lib/organiser-logo";

const TONE_CLASS = [
  "bg-primary-soft text-primary-ink",
  "bg-accent-soft text-foreground",
  "bg-[#e6f4f4] text-brand-ink",
  "bg-[#fff3e4] text-[#6b4510]",
] as const;

export function CompLogo({
  sourceId,
  organiser,
  muted = false,
}: {
  sourceId: string;
  organiser: string;
  muted?: boolean;
}) {
  const mark = organiserMark({ sourceId, organiser });
  if (!mark) return null;

  const fade = muted ? "opacity-75" : "";

  if (mark.kind === "image") {
    return (
      <span
        className={`relative mt-0.5 flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-border ${fade}`}
        data-organiser-logo={mark.src}
        aria-hidden="true"
      >
        <Image
          src={mark.src}
          alt=""
          width={128}
          height={128}
          sizes="44px"
          className="size-11 object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold tracking-tight ring-1 ring-border ${TONE_CLASS[mark.tone]} ${fade}`}
      data-organiser-logo={mark.initials}
      aria-hidden="true"
    >
      {mark.initials}
    </span>
  );
}
