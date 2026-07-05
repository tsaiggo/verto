import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";

export const metadata = {
  title: "Editor Mode",
  description: "MDX authoring with source, preview and final state coverage.",
};

export default function EditorPage() {
  const item = getFinalPackItem("03_editor-mdx-mode");
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
