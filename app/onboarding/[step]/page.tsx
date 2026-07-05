import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";
import { ONBOARDING_STATE_TO_ID } from "@/components/final/final-route-aliases";

interface OnboardingStepPageProps {
  params: Promise<{ step: string }>;
}

export function generateStaticParams() {
  return Object.keys(ONBOARDING_STATE_TO_ID).map((step) => ({ step }));
}

export async function generateMetadata({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  const item = getFinalPackItem(ONBOARDING_STATE_TO_ID[step]);
  return { title: item?.title ?? "Onboarding" };
}

export default async function OnboardingStepPage({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  const item = getFinalPackItem(ONBOARDING_STATE_TO_ID[step]);
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
