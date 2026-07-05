import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";

export const metadata = { title: "Git Changes" };

export default function GitPage() {
  const item = getFinalPackItem("08_git-changes");
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
