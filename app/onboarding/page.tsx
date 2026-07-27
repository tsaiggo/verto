import PageHeader from "@/components/layout/PageHeader";
import OnboardingFlow from "./OnboardingFlow";

export const metadata = {
  title: "Welcome to Verto",
  description: "Set up a local Markdown library and optional AI provider.",
};

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Set up Verto"
        subtitle="Local files first. AI is optional."
        frame="narrow"
      />
      <OnboardingFlow current="welcome" />
    </>
  );
}
