export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-[var(--cream-raised)] px-5 py-8 text-center ring-1 ring-[var(--line)]">
      <p className="text-2xl" aria-hidden>
        🩰
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-extrabold text-[var(--ink)]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
