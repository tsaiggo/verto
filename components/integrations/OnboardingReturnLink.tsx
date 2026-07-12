import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Keeps the source-management detour inside the onboarding journey. */
export default function OnboardingReturnLink({
  isOnboardingReturn,
}: {
  isOnboardingReturn: boolean;
}) {
  if (!isOnboardingReturn) return null;

  return (
    <Link href="/onboarding/source" className="v-btn v-btn--sm v-btn--ghost">
      <ArrowLeft aria-hidden />
      Back to setup
    </Link>
  );
}
