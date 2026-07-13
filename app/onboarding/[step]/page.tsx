import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FolderOpen, Rss, Sparkles } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

const STEP_ORDER = ["welcome", "source", "ai", "ready"] as const;
type Step = (typeof STEP_ORDER)[number];

const STEP_LABEL: Record<Step, string> = {
  welcome: "Welcome",
  source: "Connect Source",
  ai: "Connect AI",
  ready: "Next Steps",
};

const STEP_HREF: Record<Step, string> = {
  welcome: "/onboarding",
  source: "/onboarding/source",
  ai: "/onboarding/ai",
  ready: "/onboarding/ready",
};

interface OnboardingStepPageProps {
  params: Promise<{ step: string }>;
}

export function generateStaticParams() {
  return STEP_ORDER.map((step) => ({ step }));
}

export async function generateMetadata({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEP_ORDER.includes(step as Step)) return { title: "Onboarding" };
  return { title: `${STEP_LABEL[step as Step]} — Onboarding` };
}

function Steps({ current }: { current: Step }) {
  const activeIdx = STEP_ORDER.indexOf(current);
  return (
    <ol className="onboard-steps" aria-label="Onboarding steps">
      {STEP_ORDER.map((step, i) => (
        <li
          key={step}
          className={`onboard-step${i === activeIdx ? " is-active" : ""}${i < activeIdx ? " is-done" : ""}`}
        >
          <Link
            href={STEP_HREF[step]}
            className="onboard-step-link"
            aria-current={i === activeIdx ? "step" : undefined}
          >
            <span className="onboard-step-n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="onboard-step-label">{STEP_LABEL[step]}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Nav({
  prev,
  next,
}: {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <div className="onboard-nav">
      {prev ? (
        <Link href={prev.href} className="v-btn v-btn--sm">
          <ArrowLeft aria-hidden />
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="v-btn v-btn--primary">
          {next.label}
          <ArrowRight aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

const PROMISES = [
  "Local and private by default",
  "Powerful authoring and linking",
  "Agent actions require approval",
];

function WelcomeStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>Start with your own knowledge</h2>
        <p className="onboard-lede">
          Read, write, and evolve your MDX knowledge base. Verto keeps files portable, renders rich
          MDX, and gives agents grounded context.
        </p>
        <ul className="onboard-promises">
          {PROMISES.map((p) => (
            <li key={p}>
              <Check aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>
      <Nav next={{ href: "/onboarding/source", label: "Get Started" }} />
    </>
  );
}

function SourceStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>Connect your first source</h2>
        <p className="onboard-lede">
          Verto reads Markdown and MDX from your local library, and follows RSS or Atom feeds in
          Inbox. You can manage both later from Sources.
        </p>
        <ul className="onboard-source-list">
          <li className="v-card onboard-source-row">
            <span className="onboard-source-icon" aria-hidden>
              <FolderOpen />
            </span>
            <span className="onboard-source-main">
              <strong>Local Library</strong>
              <small>Point Verto at a folder of .mdx / .md files on this device.</small>
            </span>
            <Link href="/integrations?from=onboarding#local-files" className="v-btn v-btn--sm">
              Choose folder
            </Link>
          </li>
          <li className="v-card onboard-source-row">
            <span className="onboard-source-icon" aria-hidden>
              <Rss />
            </span>
            <span className="onboard-source-main">
              <strong>RSS feeds</strong>
              <small>Follow RSS or Atom feeds in Inbox.</small>
            </span>
            <Link href="/inbox?from=onboarding#subscriptions" className="v-btn v-btn--sm">
              Add feed
            </Link>
          </li>
        </ul>
        <p className="onboard-source-note">Start with either option. You can connect both later.</p>
      </section>
      <Nav
        prev={{ href: "/onboarding", label: "Back" }}
        next={{ href: "/onboarding/ai", label: "Continue without a source" }}
      />
    </>
  );
}

const AI_PROVIDERS: Array<{ name: string; desc: string; href: string }> = [
  {
    name: "Assistant access key",
    desc: "If this build enables GitHub Models, add your token in AI & Agent settings.",
    href: "/settings/agent",
  },
  {
    name: "Skip for now",
    desc: "You can enable AI later from Settings → AI & Agent.",
    href: "/onboarding/ready",
  },
];

function AiStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>Connect an AI provider</h2>
        <p className="onboard-lede">
          The Ask AI panel and agent flows require a provider. Answers stay grounded in your open
          document; writes require your explicit approval.
        </p>
        <ul className="onboard-source-list">
          {AI_PROVIDERS.map((p) => (
            <li key={p.name} className="v-card onboard-source-row">
              <span className="onboard-source-icon" aria-hidden>
                <Sparkles />
              </span>
              <span className="onboard-source-main">
                <strong>{p.name}</strong>
                <small>{p.desc}</small>
              </span>
              <Link href={p.href} className="v-btn v-btn--sm">
                Select
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Nav
        prev={{ href: "/onboarding/source", label: "Back" }}
        next={{ href: "/onboarding/ready", label: "Continue without AI" }}
      />
    </>
  );
}

const NEXT_ACTIONS = [
  { href: "/integrations", label: "Connect a source", emphasis: "primary" },
  { href: "/read/demo", label: "Read the demo", emphasis: "secondary" },
  { href: "/settings/agent", label: "Set up AI later", emphasis: "tertiary" },
] as const;

function ReadyStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>Choose your next step</h2>
        <p className="onboard-lede">
          Read the bundled demo now, or connect a local library and optionally configure AI when
          you&apos;re ready. Verto never claims a source or provider is connected until you set one
          up.
        </p>
        <div className="onboard-ready-actions">
          {NEXT_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`v-btn onboard-ready-action onboard-ready-action--${a.emphasis}${
                a.emphasis === "primary" ? " v-btn--primary" : ""
              }${a.emphasis === "tertiary" ? " v-btn--ghost" : ""}`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>
      <Nav prev={{ href: "/onboarding/ai", label: "Back" }} />
    </>
  );
}

export default async function OnboardingStepPage({ params }: OnboardingStepPageProps) {
  const { step } = await params;
  if (!STEP_ORDER.includes(step as Step)) notFound();
  const current = step as Step;
  return (
    <>
      <PageHeader title="Welcome to Verto" subtitle="Your local-first MDX knowledge workspace." />
      <div className="v-page onboard">
        <Steps current={current} />
        {current === "welcome" && <WelcomeStep />}
        {current === "source" && <SourceStep />}
        {current === "ai" && <AiStep />}
        {current === "ready" && <ReadyStep />}
      </div>
    </>
  );
}
