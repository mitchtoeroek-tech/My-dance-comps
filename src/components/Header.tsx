import Link from "next/link";
import { BrandLockup } from "./BrandMark";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center px-4 py-2.5">
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-0 items-center"
        >
          <BrandLockup variant="header" />
        </Link>
      </div>
    </header>
  );
}
