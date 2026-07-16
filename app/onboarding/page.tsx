import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import { getSourceInfo } from "@/lib/source-info";

export const metadata = { title: "Welcome to Verto" };

export default function OnboardingPage() {
  const source = getSourceInfo();
  const buildSourceReady = source.kind !== "local" || source.label.startsWith("Folder ·");
  return <OnboardingFlow step="welcome" buildSourceReady={buildSourceReady} />;
}
