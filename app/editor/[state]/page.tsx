import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { EDITOR_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface EditorStatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  return Object.keys(EDITOR_STATE_TO_ID).map((state) => ({ state }));
}

export async function generateMetadata({ params }: EditorStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(EDITOR_STATE_TO_ID[state]);
  return { title: item?.title ?? "Editor State" };
}

export default async function EditorStatePage({ params }: EditorStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(EDITOR_STATE_TO_ID[state]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
