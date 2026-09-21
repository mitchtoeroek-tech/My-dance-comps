"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body className="min-h-full bg-[#fbf4ea] px-4 py-10 text-[#3a2430]">
        <div className="mx-auto max-w-lg space-y-3 text-center">
          <h1 className="text-2xl font-extrabold">My Dance Comps couldn’t load</h1>
          <p className="text-sm leading-6 text-[#6b4f5c]">
            A display error stopped this screen. Your family data on this phone
            is still saved. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-[#c81e5d] px-4 py-2 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
