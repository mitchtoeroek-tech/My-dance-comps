import type { RegistrationStatus } from "@/lib/types";
import { statusLabel } from "@/lib/comps";

const styles: Record<RegistrationStatus, string> = {
  open: "bg-status-open text-status-open-ink",
  "opens-soon": "bg-status-opening text-status-opening-ink",
  "closing-soon": "bg-status-closing text-status-closing-ink",
  closed: "bg-status-closed text-status-closed-ink",
  unknown: "bg-status-unknown text-status-unknown-ink",
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
