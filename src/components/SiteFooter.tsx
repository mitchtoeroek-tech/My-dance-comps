import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 text-center">
      <p className="text-xs font-medium text-muted-foreground">
        Australian youth dance competitions
      </p>
      <p className="mt-1">
        <Link href="/studios" className="inline-flex min-h-11 items-center text-xs font-bold text-primary-ink underline">
          Dance studios
        </Link>
      </p>
    </footer>
  );
}
