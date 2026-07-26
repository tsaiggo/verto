export const STEP_ORDER = ["welcome", "source", "indexing", "ai", "ready"] as const;
export type OnboardingStep = (typeof STEP_ORDER)[number];

export const STEP_LABEL: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  source: "Choose folder",
  indexing: "Index files",
  ai: "Connect AI",
  ready: "Ready",
};

export const STEP_HREF: Record<OnboardingStep, string> = {
  welcome: "/onboarding",
  source: "/onboarding/source",
  indexing: "/onboarding/indexing",
  ai: "/onboarding/ai",
  ready: "/onboarding/ready",
};
