import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { GIT_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface GitStatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  return Object.keys(GIT_STATE_TO_ID).map((state) => ({ state }));
}

export async function generateMetadata({ params }: GitStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(GIT_STATE_TO_ID[state]);
  return { title: item?.title ?? "Git" };
}

export default async function GitStatePage({ params }: GitStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(GIT_STATE_TO_ID[state]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
