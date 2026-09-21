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
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-3"
          aria-label={title ? `${title} — My Dance Comps home` : "My Dance Comps home"}
        >
          <BrandMark />
          <div className="min-w-0 leading-tight">
            {title ? (
              <p className="text-lg font-bold tracking-tight text-foreground">
                {title}
              </p>
            ) : null}
            <p className="text-xs font-medium text-muted-foreground">
              {subtitle ?? "Australian youth dance competitions"}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
