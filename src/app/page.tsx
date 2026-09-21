import { getComps } from "@/lib/comps";
import { CompsView } from "@/components/CompsView";

export default function HomePage() {
  const comps = getComps();
  return <CompsView initialComps={comps} />;
}
