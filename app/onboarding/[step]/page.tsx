import { notFound } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import OnboardingFlow from "@/app/onboarding/OnboardingFlow";
import { STEP_ORDER, type OnboardingStep } from "@/app/onboarding/onboarding-steps";

const STEP_TITLE: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  source: "Choose a folder",
  indexing: "Index local files",
  ai: "Optional AI",
  ready: "Ready",
};

interface OnboardingStepPageProps {
  params: Promise<{ step: string }>;
}

export function generateStaticParams() {
  return STEP_ORDER.map((step) => ({ step }));
}

export async function generateMetadata({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEP_ORDER.includes(step as OnboardingStep)) return { title: "Onboarding" };
  return { title: `${STEP_TITLE[step as OnboardingStep]} | Onboarding` };
}

export default async function OnboardingStepPage({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEP_ORDER.includes(step as OnboardingStep)) notFound();

  return (
    <>
      <PageHeader
        title="Set up Verto"
        subtitle="Local files first. AI is optional."
        frame="narrow"
      />
      <OnboardingFlow current={step as OnboardingStep} />
    </>
  );
}
