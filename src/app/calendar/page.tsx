import { getComps } from "@/lib/comps";
import { CalendarView } from "@/components/CalendarView";

export const metadata = {
  title: "Calendar",
};

export default function CalendarPage() {
  return <CalendarView initialComps={getComps()} />;
}
