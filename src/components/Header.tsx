import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center"
          aria-label="My Dance Comps home"
        >
          <BrandMark />
        </Link>
      </div>
    </header>
  );
}
