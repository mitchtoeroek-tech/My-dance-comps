import Image from "next/image";

const MARK_WIDTH = 334;
const MARK_HEIGHT = 468;
const LOCKUP_WIDTH = 644;
const LOCKUP_HEIGHT = 801;

const HEADER_MARK_SIZE = 56;

export function BrandMark({ size = HEADER_MARK_SIZE }: { size?: number }) {
  const width = Math.round((size * MARK_WIDTH) / MARK_HEIGHT);
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={width}
      height={size}
      className="h-14 w-auto shrink-0 object-contain object-center"
      sizes={`${width}px`}
      preload
    />
  );
}

export function BrandWordmark() {
  return (
    <span className="flex min-w-0 flex-col items-start leading-none">
      <span className="font-brand-sans text-[1.35rem] font-extrabold tracking-[-0.035em] text-brand-ink">
        My Dance
      </span>
      <span className="font-brand-script -mt-0.5 ml-3.5 text-[1.55rem] leading-none text-primary">
        Comps
      </span>
    </span>
  );
}

export function BrandLockup({
  variant = "header",
}: {
  variant?: "header" | "stacked";
}) {
  if (variant === "stacked") {
    return (
      <Image
        src="/logo.png"
        alt="My Dance Comps"
        width={LOCKUP_WIDTH}
        height={LOCKUP_HEIGHT}
        className="h-auto w-[min(100%,11.5rem)] object-contain"
        sizes="184px"
        preload
      />
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <BrandWordmark />
    </span>
  );
}
