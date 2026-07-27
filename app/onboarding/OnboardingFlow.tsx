"use client";

import Link from "next/link";
import {
  Check,
  CircleAlert,
  CircleCheck,
  FolderOpen,
  Rss,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import LocalFolderPickerButton from "@/components/integrations/LocalFolderPickerButton";
import PageFrame from "@/components/layout/PageFrame";
import { STEP_HREF, STEP_LABEL, STEP_ORDER, type OnboardingStep } from "./onboarding-steps";
import OnboardingIndexingStep from "./OnboardingIndexingStep";
import { Navigation, StepSurface, useFolderSnapshot } from "./OnboardingShared";
import styles from "./Onboarding.module.css";

function Steps({ current }: { current: OnboardingStep }) {
  const activeIndex = STEP_ORDER.indexOf(current);
  return (
    <ol className={styles.steps} aria-label="Onboarding steps">
      {STEP_ORDER.map((step, index) => (
        <li
          key={step}
          className={`${styles.step}${index === activeIndex ? ` ${styles.stepActive}` : ""}${
            index < activeIndex ? ` ${styles.stepDone}` : ""
          }`}
        >
          <Link
            href={STEP_HREF[step]}
            className={styles.stepLink}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span className={styles.stepNumber} aria-hidden>
              {index < activeIndex ? <Check size={12} /> : index + 1}
            </span>
            <span className={styles.stepLabel}>{STEP_LABEL[step]}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function WelcomeStep() {
  const benefits = [
    "Read and edit portable Markdown or MDX files",
    "Use an existing OneDrive or Dropbox folder for cross-device sync",
    "Keep AI optional, cited, and approval-based",
  ];

  return (
    <>
      <StepSurface
        icon={<ShieldCheck />}
        title="Your library, without another cloud"
        description="Verto reads the folders you already own, turns them into a focused reading workspace, and keeps every Agent write reviewable."
        meta="About 2 minutes. Every step can be skipped."
      >
        <ul className={styles.benefits}>
          {benefits.map((benefit) => (
            <li className={styles.benefit} key={benefit}>
              <Check aria-hidden />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </StepSurface>
      <Navigation
        next={{ step: "source", label: "Choose a folder" }}
        skip={{ href: "/library", label: "Skip setup" }}
      />
    </>
  );
}

function FolderStep() {
  const folder = useFolderSnapshot();
  const hasLostBrowserAccess = folder.remembered !== null && folder.readable === null;

  return (
    <>
      <StepSurface
        icon={<FolderOpen />}
        title="Choose the folder you already use"
        description="Verto reads .md and .mdx files in place. It does not move them or create a Verto cloud copy."
      >
        <h3>Local library</h3>
        <p className={styles.bodyCopy}>
          A OneDrive, Dropbox, iCloud Drive, or network folder works when it is available locally
          through your operating system.
        </p>

        {folder.readable ? (
          <div className={styles.folderStatus} role="status">
            <CircleCheck aria-hidden />
            <div>
              <strong>Folder access is ready</strong>
              <code>{folder.readable}</code>
            </div>
          </div>
        ) : hasLostBrowserAccess ? (
          <div className={styles.folderStatus} data-tone="attention" role="alert">
            <CircleAlert aria-hidden />
            <div>
              <strong>Choose this folder again to restore access</strong>
              <code>{folder.remembered}</code>
            </div>
          </div>
        ) : null}

        <ul className={styles.sourceChoices}>
          <li className={styles.sourceChoice}>
            <span className={styles.sourceIcon} aria-hidden>
              <FolderOpen />
            </span>
            <span className={styles.sourceCopy}>
              <strong>Markdown folder</strong>
              <small>Grant read and write access through the native folder picker.</small>
            </span>
            <LocalFolderPickerButton className="v-btn v-btn--primary v-btn--sm">
              {folder.remembered ? "Choose again" : "Choose folder"}
            </LocalFolderPickerButton>
          </li>
          <li className={styles.sourceChoice}>
            <span className={styles.sourceIcon} aria-hidden>
              <Rss />
            </span>
            <span className={styles.sourceCopy}>
              <strong>RSS feeds</strong>
              <small>Optional reading subscriptions live in Inbox, outside the file library.</small>
            </span>
            <Link href="/inbox?from=onboarding#subscriptions" className="v-btn v-btn--sm">
              Add feed
            </Link>
          </li>
        </ul>

        <p className={styles.bodyCopy}>
          If folder picking is unavailable here, continue now and use the Verto desktop app later.
          The included demo remains readable.
        </p>
      </StepSurface>
      <Navigation
        previous="welcome"
        next={{
          step: "indexing",
          label: folder.readable ? "Check files" : "Continue without a folder",
        }}
      />
    </>
  );
}

const AI_PROVIDERS = [
  { name: "Provider settings", href: "/settings/agent" },
  { name: "Skip for now", href: "/onboarding/ready" },
] as const;

function AiStep() {
  return (
    <>
      <StepSurface
        icon={<Sparkles />}
        title="AI is optional"
        description="The Agent can answer from the current document and propose file changes. Every write stays behind an explicit preview and approval."
      >
        <div className={styles.aiPanel}>
          <AssistantConnectPanel />
        </div>
        <div className={styles.readyActions}>
          {AI_PROVIDERS.map((provider) => (
            <Link key={provider.name} href={provider.href} className="v-btn v-btn--sm">
              {provider.name}
            </Link>
          ))}
        </div>
      </StepSurface>
      <Navigation
        previous="indexing"
        next={{ step: "ready", label: "Continue" }}
        skip={{ href: "/onboarding/ready", label: "Continue without AI" }}
      />
    </>
  );
}

const NEXT_ACTIONS = [
  { href: "/integrations", label: "Connect a source", primary: true },
  { href: "/library", label: "Open Library", primary: false },
  { href: "/editor", label: "Create a document", primary: false },
  { href: "/settings/agent", label: "Set up AI later", primary: false },
] as const;

function ReadyStep() {
  return (
    <>
      <StepSurface
        icon={<CircleCheck />}
        title="Choose your next step"
        description="Open the included demo immediately, connect or revisit a folder, and enable AI only when it is useful."
      >
        <div className={styles.readyActions}>
          {NEXT_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`v-btn${action.primary ? " v-btn--primary" : ""}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </StepSurface>
      <Navigation previous="ai" />
    </>
  );
}

export default function OnboardingFlow({ current }: { current: OnboardingStep }) {
  return (
    <PageFrame as="section" size="narrow" className={styles.page} aria-label="Verto setup">
      <Steps current={current} />
      {current === "welcome" ? <WelcomeStep /> : null}
      {current === "source" ? <FolderStep /> : null}
      {current === "indexing" ? <OnboardingIndexingStep /> : null}
      {current === "ai" ? <AiStep /> : null}
      {current === "ready" ? <ReadyStep /> : null}
    </PageFrame>
  );
}
