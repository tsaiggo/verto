import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { AGENT_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface AgentStatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  return Object.keys(AGENT_STATE_TO_ID).map((state) => ({ state }));
}

export async function generateMetadata({ params }: AgentStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(AGENT_STATE_TO_ID[state]);
  return { title: item?.title ?? "Agent State" };
}

export default async function AgentStatePage({ params }: AgentStatePageProps) {
  const { state } = await params;
  const item = getFinalPackItem(AGENT_STATE_TO_ID[state]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
