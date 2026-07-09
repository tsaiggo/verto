import Link from "next/link";
import { Check } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

export const metadata = { title: "Welcome to Verto" };

const STEPS = [
  { n: 1, label: "Welcome", active: true },
  { n: 2, label: "Connect Source" },
  { n: 3, label: "Connect AI" },
  { n: 4, label: "Open Document" },
];

const PROMISES = [
  "Local and private by default",
  "Powerful authoring and linking",
  "Agent actions require approval",
];

const CAN_DO = [
  { n: 1, title: "Open your library", desc: "Local library and RSS feeds" },
  { n: 2, title: "Organize your knowledge", desc: "Collections, tags and links" },
  { n: 3, title: "Write with MDX", desc: "Components, diagrams and live preview" },
  { n: 4, title: "Ask AI and get insights", desc: "Grounded in your own sources" },
];

export default function OnboardingPage() {
  return (
    <>
      <PageHeader title="Welcome to Verto" subtitle="Your local-first MDX knowledge workspace." />

      <div className="v-page onboard">
        <ol className="onboard-steps" aria-label="Onboarding steps">
          {STEPS.map((step) => (
            <li key={step.n} className={`onboard-step${step.active ? " is-active" : ""}`}>
              <span className="onboard-step-n">{step.n}</span>
              <span className="onboard-step-label">{step.label}</span>
            </li>
          ))}
        </ol>

        <section className="v-card onboard-hero">
          <h2>Start with your own knowledge</h2>
          <p className="onboard-lede">
            Read, write, and evolve your MDX knowledge base. Verto keeps files portable, renders
            rich MDX, and gives agents grounded context.
          </p>
          <ul className="onboard-promises">
            {PROMISES.map((p) => (
              <li key={p}>
                <Check aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link href="/onboarding/source" className="v-btn v-btn--primary onboard-cta">
            Get Started
          </Link>
        </section>

        <section className="onboard-cando">
          <h3>What you can do</h3>
          <div className="onboard-cando-grid">
            {CAN_DO.map((c) => (
              <article key={c.n} className="v-card onboard-cando-card">
                <span className="onboard-cando-n">{c.n}</span>
                <span className="onboard-cando-title">{c.title}</span>
                <span className="onboard-cando-desc">{c.desc}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
