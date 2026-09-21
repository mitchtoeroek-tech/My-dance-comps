import type { RegistrationStatus } from "@/lib/types";
import { statusLabel } from "@/lib/comps";

const styles: Record<RegistrationStatus, string> = {
  "opens-soon": "bg-accent-soft text-foreground",
  open: "bg-primary-soft text-primary-ink",
  "closing-soon": "bg-accent text-foreground",
  closed: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: RegistrationStatus }) {
  const tone = styles[status] ?? styles.unknown;
  return (
    <span
      className={`inline-flex rounded-control px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}
    >
      {statusLabel(status ?? "unknown")}
    </span>
  );
}
