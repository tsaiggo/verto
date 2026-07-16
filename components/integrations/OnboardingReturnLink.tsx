"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingReturn } from "./use-onboarding-return";

/** Keeps the source-management detour inside the onboarding journey. */
export default function OnboardingReturnLink() {
  const isOnboardingReturn = useOnboardingReturn();

  if (!isOnboardingReturn) return null;

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/onboarding/source">
        <ArrowLeft aria-hidden />
        Back to setup
      </Link>
    </Button>
  );
}
