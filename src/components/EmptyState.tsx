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
    <div className="rounded-card bg-surface px-5 py-8 text-center shadow-card ring-1 ring-border">
      <p
        className="mx-auto grid h-12 w-12 place-items-center rounded-card bg-primary-soft text-2xl"
        aria-hidden
      >
        🩰
      </p>
      <h2 className="mt-3 text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
