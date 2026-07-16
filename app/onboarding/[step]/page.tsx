import { notFound } from "next/navigation";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { getSourceInfo } from "@/lib/source-info";

const STEPS = ["source", "ai", "ready"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABEL: Record<Step, string> = {
  source: "Connect source",
  ai: "Connect AI",
  ready: "Next steps",
};

interface OnboardingStepPageProps {
  params: Promise<{ step: string }>;
}

export function generateStaticParams() {
  return STEPS.map((step) => ({ step }));
}

export async function generateMetadata({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEPS.includes(step as Step)) return { title: "Onboarding" };
  return { title: `${STEP_LABEL[step as Step]}: Onboarding` };
}

export default async function OnboardingStepPage({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEPS.includes(step as Step)) notFound();
  const source = getSourceInfo();
  const buildSourceReady = source.kind !== "local" || source.label.startsWith("Folder ·");
  return <OnboardingFlow step={step as Step} buildSourceReady={buildSourceReady} />;
}
