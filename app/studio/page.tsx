import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";

export const metadata = { title: "Knowledge Studio" };

interface KnowledgeCard {
  title: string;
  kind: string;
  description: string;
  links: number;
  href: string;
}

const CARDS: KnowledgeCard[] = [
  {
    title: "Agent-native Workflows",
    kind: "Workflow",
    description: "Roles, tools and guardrails.",
    links: 18,
    href: "/read/agent-native-workflows",
  },
  {
    title: "Design Principles",
    kind: "Principles",
    description: "Core AI product principles.",
    links: 15,
    href: "/read/design-principles",
  },
  {
    title: "Product Strategy 2025",
    kind: "Strategy",
    description: "Goals and positioning.",
    links: 9,
    href: "/read/product-strategy",
  },
  {
    title: "Evaluation Framework",
    kind: "Framework",
    description: "Reliability and relevance.",
    links: 7,
    href: "/read/evaluation-framework",
  },
  {
    title: "Competitive Landscape",
    kind: "Research",
    description: "Adjacent product analysis.",
    links: 15,
    href: "/read/competitive-landscape",
  },
  {
    title: "User Research Synthesis",
    kind: "Research",
    description: "Interview insights.",
    links: 11,
    href: "/read/user-research-synthesis",
  },
];

export default function StudioPage() {
  return (
    <>
      <PageHeader
        title="Knowledge Studio"
        subtitle="Connected ideas and reusable knowledge cards."
        tools={
          <button type="button" className="v-btn v-btn--sm">
            <Plus aria-hidden /> New Card
          </button>
        }
      />
      <PageTabs tabs={["Cards", "Templates", "Insights", "Drafts"]} />

      <div className="v-page">
        <div className="studio-grid">
          {CARDS.map((card) => (
            <Link key={card.title} href={card.href} className="v-card studio-tile">
              <span className="studio-tile-kind">{card.kind}</span>
              <span className="studio-tile-title">{card.title}</span>
              <span className="studio-tile-desc">{card.description}</span>
              <span className="studio-tile-links">{card.links} links</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
