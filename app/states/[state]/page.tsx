import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { SYSTEM_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface SystemStatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  return Object.keys(SYSTEM_STATE_TO_ID).map((state) => ({ state }));
}

export async function generateMetadata({ params }: SystemStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(SYSTEM_STATE_TO_ID[state]);
  return { title: item?.title ?? "System State" };
}

export default async function SystemStatePage({ params }: SystemStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(SYSTEM_STATE_TO_ID[state]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
