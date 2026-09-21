import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <p className="text-3xl" aria-hidden>
        💫
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Page not found
      </h1>
      <p className="text-sm text-[var(--ink-soft)]">
        That routine is not on this programme.
      </p>
      <Link
        href="/"
        className="inline-flex rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
      >
        Back to comps
      </Link>
    </div>
  );
}
