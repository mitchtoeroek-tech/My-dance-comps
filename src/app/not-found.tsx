import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <p
        className="mx-auto grid h-12 w-12 place-items-center rounded-card bg-accent-soft text-3xl"
        aria-hidden
      >
        💫
      </p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That routine is not on this programme.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
      >
        Back to comps
      </Link>
    </div>
  );
}
