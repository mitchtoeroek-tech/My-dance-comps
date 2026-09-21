import Image from "next/image";

const MARK_WIDTH = 761;
const MARK_HEIGHT = 496;

export function BrandMark({ size = 44 }: { size?: number }) {
  const width = Math.round((size * MARK_WIDTH) / MARK_HEIGHT);
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={width}
      height={size}
      className="h-11 w-auto shrink-0 object-contain"
      priority
    />
  );
}
