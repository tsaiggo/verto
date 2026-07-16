import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { FINAL_PACK_ITEMS, getFinalPackItem } from "@/components/final/final-pack-data";

const referencePackEnabled = process.env.VERTO_SHOW_REFERENCE_PACK === "1";

interface FinalPackPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return FINAL_PACK_ITEMS.map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: FinalPackPageProps) {
  if (!referencePackEnabled) return { title: "Not Found" };
  const { id } = await params;
  const item = getFinalPackItem(id);
  if (!item) return { title: "Not Found" };
  return {
    title: `${item.title} | Final Pack`,
    description: item.notes,
  };
}

export default async function FinalPackPage({ params }: FinalPackPageProps) {
  if (!referencePackEnabled) notFound();
  const { id } = await params;
  const item = getFinalPackItem(id);
  if (!item) notFound();
  return <FinalPackScreen item={item} />;
}
