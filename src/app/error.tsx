"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 py-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        This page had a problem
      </h1>
      <p className="text-sm leading-6 text-[var(--ink-soft)]">
        Your kids, saved comps and reminder settings stay on this device. You
        can try again without losing them.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-[var(--raspberry)] px-4 py-2 text-sm font-bold text-white"
      >
        Try again
      </button>
    </div>
  );
}
