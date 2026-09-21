import { getComps } from "@/lib/comps";
import { MyCompsView } from "@/components/MyCompsView";

export const metadata = {
  title: "My Comps",
};

export default function MyCompsPage() {
  return <MyCompsView initialComps={getComps()} />;
}
