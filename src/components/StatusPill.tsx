import type { RegistrationStatus } from "@/lib/types";
import { statusLabel } from "@/lib/comps";

const styles: Record<RegistrationStatus, string> = {
  "opens-soon": "bg-[var(--gold-soft)] text-[var(--gold-ink)]",
  open: "bg-[var(--teal-soft)] text-[var(--teal)]",
  "closing-soon": "bg-[var(--raspberry-soft)] text-[var(--raspberry)]",
  closed: "bg-[var(--muted)] text-[var(--ink-soft)]",
  unknown: "bg-[var(--muted)] text-[var(--ink-soft)]",
};

export function StatusPill({ status }: { status: RegistrationStatus }) {
  const tone = styles[status] ?? styles.unknown;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}
    >
      {statusLabel(status ?? "unknown")}
    </span>
  );
}
