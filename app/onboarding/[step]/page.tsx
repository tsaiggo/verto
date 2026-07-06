import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Cloud, FolderOpen, Github, Sparkles } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

const STEP_ORDER = ["welcome", "source", "ai", "ready"] as const;
type Step = (typeof STEP_ORDER)[number];

const STEP_LABEL: Record<Step, string> = {
  welcome: "Welcome",
  source: "Connect Source",
  ai: "Connect AI",
  ready: "Open Document",
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
          <span className="onboard-step-n">{i + 1}</span>
          <span className="onboard-step-label">{STEP_LABEL[step]}</span>
        </li>
      ))}
    </ol>
  );
}

function Nav({ prev, next }: { prev?: { href: string; label: string }; next?: { href: string; label: string } }) {
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

const SOURCES = [
  { icon: FolderOpen, name: "Local folder", desc: "Point Verto at a folder of `.mdx` / `.md` files." },
  { icon: Github, name: "GitHub", desc: "Connect a public or private repo of documents." },
  { icon: Cloud, name: "OneDrive", desc: "Read from a shared or private OneDrive folder." },
];

function SourceStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>Connect your first source</h2>
        <p className="onboard-lede">
          Verto reads Markdown and MDX from a source you own. Pick one to start — you can add more
          later from Integrations.
        </p>
        <ul className="onboard-source-list">
          {SOURCES.map((s) => (
            <li key={s.name} className="v-card onboard-source-row">
              <span className="onboard-source-icon" aria-hidden>
                <s.icon />
              </span>
              <span className="onboard-source-main">
                <strong>{s.name}</strong>
                <small>{s.desc}</small>
              </span>
              <Link href="/integrations" className="v-btn v-btn--sm">
                Select
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Nav
        prev={{ href: "/onboarding", label: "Back" }}
        next={{ href: "/onboarding/ai", label: "Continue" }}
      />
    </>
  );
}

const AI_PROVIDERS = [
  { name: "GitHub Models (Copilot token)", desc: "Reuse your GitHub sign-in — no extra key." },
  { name: "Bring your own key", desc: "Paste an OpenAI-compatible API key." },
  { name: "Skip for now", desc: "You can enable AI later from Settings → AI & Agent." },
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
              <button type="button" className="v-btn v-btn--sm">
                Select
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Nav
        prev={{ href: "/onboarding/source", label: "Back" }}
        next={{ href: "/onboarding/ready", label: "Continue" }}
      />
    </>
  );
}

const NEXT_ACTIONS = [
  { href: "/read", label: "Open a document" },
  { href: "/library", label: "Browse the library" },
  { href: "/agent", label: "Ask the agent" },
];

function ReadyStep() {
  return (
    <>
      <section className="v-card onboard-hero">
        <h2>You&apos;re ready to read</h2>
        <p className="onboard-lede">
          Verto is connected. Open your first document, browse the library, or ask the agent a
          question grounded in your workspace.
        </p>
        <ul className="onboard-promises">
          <li>
            <Check aria-hidden />
            <span>Source connected</span>
          </li>
          <li>
            <Check aria-hidden />
            <span>AI provider linked</span>
          </li>
          <li>
            <Check aria-hidden />
            <span>Workspace indexed</span>
          </li>
        </ul>
        <div className="onboard-ready-actions">
          {NEXT_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="v-btn v-btn--sm">
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
      <PageHeader
        title="Welcome to Verto"
        subtitle="Your local-first MDX knowledge workspace."
      />
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
