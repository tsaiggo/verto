import { notFound } from "next/navigation";
import FinalPackScreen from "@/components/final/FinalPackScreen";
import { getFinalPackItem } from "@/components/final/final-pack-data";

export const metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  const item = getFinalPackItem("71_onboarding-welcome");
  if (!item) notFound();
  return <FinalPackScreen item={item} showRelated={false} />;
}
