import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { SETTINGS_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface SettingsSectionPageProps {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return Object.keys(SETTINGS_STATE_TO_ID).map((section) => ({ section }));
}

export async function generateMetadata({ params }: SettingsSectionPageProps) {
  const { section } = await params;
  const item = getFinalPackItem(SETTINGS_STATE_TO_ID[section]);
  return { title: item?.title ?? "Settings" };
}

export default async function SettingsSectionPage({ params }: SettingsSectionPageProps) {
  const { section } = await params;
  const item = getFinalPackItem(SETTINGS_STATE_TO_ID[section]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
