"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FolderOpen,
  LibraryBig,
  Rss,
  Sparkles,
} from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { Button } from "@/components/ui/button";
import {
  ContentPanel,
  ContentRow,
  ContentSection,
  ContentStatus,
} from "@/components/ui/content-primitives";
import {
  EMPTY_ONBOARDING_STATE,
  parseSetupReadiness,
  setupReadinessSnapshot,
  subscribeSetupReadiness,
  updateOnboardingState,
} from "@/lib/onboarding";
import styles from "./OnboardingFlow.module.css";

export const ONBOARDING_STEPS = ["welcome", "source", "ai", "ready"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const STEP_LABEL: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  source: "Connect source",
  ai: "Connect AI",
  ready: "Next steps",
};

const STEP_HREF: Record<OnboardingStep, string> = {
  welcome: "/onboarding",
  source: "/onboarding/source",
  ai: "/onboarding/ai",
  ready: "/onboarding/ready",
};

const SERVER_SETUP = JSON.stringify({
  source: false,
  assistant: false,
  library: false,
  reading: false,
  onboarding: EMPTY_ONBOARDING_STATE,
});

export default function OnboardingFlow({
  step,
  buildSourceReady = false,
}: {
  step: OnboardingStep;
  buildSourceReady?: boolean;
}) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(
    subscribeSetupReadiness,
    () => setupReadinessSnapshot(buildSourceReady),
    () => SERVER_SETUP
  );
  const readiness = useMemo(() => parseSetupReadiness(snapshot), [snapshot]);

  const skipSource = () => {
    updateOnboardingState({ skippedSource: true });
    router.push("/onboarding/ai");
  };
  const skipAssistant = () => {
    updateOnboardingState({ skippedAssistant: true });
    router.push("/onboarding/ready");
  };
  const finish = () => {
    updateOnboardingState({ completed: true, libraryOpened: true });
    router.push("/library");
  };

  return (
    <ContentPage width="compact">
      <ContentHeader
        title="Set up Verto"
        description="Connect the parts you need now. Skipped steps remain available from Sources and Settings."
      />
      <StepNavigation current={step} readiness={readiness} />
      {step === "welcome" ? <WelcomeStep /> : null}
      {step === "source" ? <SourceStep onSkip={skipSource} /> : null}
      {step === "ai" ? <AssistantStep onSkip={skipAssistant} /> : null}
      {step === "ready" ? <ReadyStep readiness={readiness} onFinish={finish} /> : null}
    </ContentPage>
  );
}

function StepNavigation({
  current,
  readiness,
}: {
  current: OnboardingStep;
  readiness: ReturnType<typeof parseSetupReadiness>;
}) {
  const completed: Record<OnboardingStep, boolean> = {
    welcome: current !== "welcome",
    source: readiness.source || readiness.onboarding.skippedSource,
    ai: readiness.assistant || readiness.onboarding.skippedAssistant,
    ready: readiness.onboarding.completed,
  };

  return (
    <nav className={styles.steps} aria-label="Onboarding steps">
      <ol>
        {ONBOARDING_STEPS.map((item, index) => (
          <li key={item}>
            <Link
              href={STEP_HREF[item]}
              className={item === current ? styles.currentStep : undefined}
              aria-current={item === current ? "step" : undefined}
            >
              <span className={styles.stepMarker} aria-hidden>
                {completed[item] ? <Check /> : index + 1}
              </span>
              <span>{STEP_LABEL[item]}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function WelcomeStep() {
  const promises = [
    "Your Markdown and MDX files stay portable.",
    "Reading, writing, search, and organization work without AI.",
    "The assistant only receives the context needed for your request.",
  ];

  return (
    <ContentSection
      title="Start with your own knowledge"
      description="Verto is a local-first workspace for reading, writing, and organizing durable notes."
    >
      <ContentPanel variant="outlined" className={styles.promiseList}>
        {promises.map((promise) => (
          <div key={promise} className={styles.promise}>
            <Check aria-hidden />
            <span>{promise}</span>
          </div>
        ))}
      </ContentPanel>
      <div className={styles.singleAction}>
        <Button asChild>
          <Link href="/onboarding/source">
            Get started
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </ContentSection>
  );
}

function SourceStep({ onSkip }: { onSkip: () => void }) {
  return (
    <ContentSection
      title="Connect your first source"
      description="Choose a local Markdown folder or follow an RSS feed. You can use either one or both."
    >
      <ContentPanel variant="plain">
        <ContentRow
          leading={<FolderOpen aria-hidden />}
          title="Local library"
          description="Read and write .md or .mdx files on this device."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/integrations?from=onboarding#local-files">Choose folder</Link>
            </Button>
          }
        />
        <ContentRow
          leading={<Rss aria-hidden />}
          title="RSS or Atom"
          description="Follow publications and triage new articles in Inbox."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/inbox?from=onboarding#subscriptions">Add feed</Link>
            </Button>
          }
        />
      </ContentPanel>
      <StepActions
        back={{ href: "/onboarding", label: "Back" }}
        secondary={{ label: "Continue without a source", onClick: onSkip }}
      />
    </ContentSection>
  );
}

function AssistantStep({ onSkip }: { onSkip: () => void }) {
  return (
    <ContentSection
      title="Connect an AI provider"
      description="Agent features are optional. When enabled, answers stay grounded in your selected workspace sources."
    >
      <ContentPanel variant="plain">
        <ContentRow
          leading={<Sparkles aria-hidden />}
          title="Assistant provider"
          description="Review the provider enabled in this build and add a local access key when required."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/agent?from=onboarding">Open AI settings</Link>
            </Button>
          }
        />
      </ContentPanel>
      <StepActions
        back={{ href: "/onboarding/source", label: "Back" }}
        secondary={{ label: "Continue without AI", onClick: onSkip }}
      />
    </ContentSection>
  );
}

function ReadyStep({
  readiness,
  onFinish,
}: {
  readiness: ReturnType<typeof parseSetupReadiness>;
  onFinish: () => void;
}) {
  return (
    <ContentSection
      title="Review your workspace"
      description="These statuses come from the current device, not from the step you are viewing."
    >
      <div className={styles.reviewList}>
        <ContentStatus
          icon={<FolderOpen aria-hidden />}
          title={readiness.source ? "Content source ready" : "No personal source connected"}
          description={
            readiness.source
              ? "Verto can read at least one configured source."
              : "The bundled demo remains available until you connect one."
          }
          action={
            !readiness.source ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/integrations?from=onboarding">Connect</Link>
              </Button>
            ) : null
          }
        />
        <ContentStatus
          icon={<Sparkles aria-hidden />}
          title={readiness.assistant ? "Assistant ready" : "Assistant not configured"}
          description={
            readiness.assistant
              ? "Agent can use the provider enabled for this build."
              : "Reading, writing, search, and organization still work without AI."
          }
          action={
            !readiness.assistant ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/agent?from=onboarding">Review</Link>
              </Button>
            ) : null
          }
        />
      </div>
      <div className={styles.readyActions}>
        <Button asChild variant="outline">
          <Link href="/read/demo">
            <BookOpen aria-hidden />
            Read the demo
          </Link>
        </Button>
        <Button type="button" onClick={onFinish}>
          <LibraryBig aria-hidden />
          Open library
        </Button>
      </div>
      <StepActions back={{ href: "/onboarding/ai", label: "Back" }} />
    </ContentSection>
  );
}

function StepActions({
  back,
  secondary,
}: {
  back: { href: string; label: string };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className={styles.stepActions}>
      <Button asChild variant="ghost" size="sm">
        <Link href={back.href}>
          <ArrowLeft aria-hidden />
          {back.label}
        </Link>
      </Button>
      {secondary ? (
        <Button type="button" variant="outline" size="sm" onClick={secondary.onClick}>
          {secondary.label}
          <ArrowRight aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
