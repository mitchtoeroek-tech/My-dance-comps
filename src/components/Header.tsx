import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Header({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2.5">
          <BrandMark size={40} />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-foreground">
              {title ?? "My Dance Comps"}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {subtitle ?? "Australian youth dance competitions"}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
