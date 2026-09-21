import Image from "next/image";

const LOGO_WIDTH = 644;
const LOGO_HEIGHT = 801;
const DISPLAY_HEIGHT = 104;

export function BrandMark({
  height = DISPLAY_HEIGHT,
}: {
  height?: number;
}) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);
  return (
    <Image
      src="/logo.png"
      alt="My Dance Comps"
      width={width}
      height={height}
      className="h-[6.5rem] w-auto shrink-0 object-contain object-left"
      sizes={`${width}px`}
      priority
    />
  );
}
