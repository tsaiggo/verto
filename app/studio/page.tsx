import Link from "next/link";
import { GitBranch } from "lucide-react";
import { listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";
import { SAMPLE_DOCS } from "@/components/pages/sample";

export const metadata = { title: "Knowledge Studio" };

const KINDS = ["Concept", "Guide", "Strategy", "Framework", "Research", "Research"];
const TINTS = ["#f5d0fe", "#bbf7d0", "#ddd6fe", "#fde68a", "#fed7aa", "#e5e7eb"];

interface Card {
  title: string;
  kind: string;
  excerpt: string;
  links: number;
  tint: string;
  href: string;
}

export default async function StudioPage() {
  const files = await listAllFiles();
  const real = files.filter((f) => !f.hidden && !f.draft).slice(0, 6);

  const cards: Card[] =
    real.length > 0
      ? real.map((f, i) => ({
          title: f.title,
          kind: KINDS[i % KINDS.length],
          excerpt: f.dek ?? f.description ?? "A knowledge card in your second brain.",
          links: 4 + ((i * 5) % 15),
          tint: TINTS[i % TINTS.length],
          href: f.href,
        }))
      : SAMPLE_DOCS.slice(0, 6).map((d, i) => ({
          title: d.title,
          kind: KINDS[i % KINDS.length],
          excerpt: d.excerpt,
          links: 4 + ((i * 5) % 15),
          tint: TINTS[i % TINTS.length],
          href: d.href,
        }));

  return (
    <>
      <PageHeader
        title="Knowledge Studio"
        subtitle="Connect ideas, create knowledge cards, and build your second brain."
        flush
      />
      <PageTabs tabs={["Cards", "Templates", "Insights", "Drafts"]} />

      <div className="v-page">
        <div className="studio-grid">
          {cards.map((card, i) => (
            <Link
              key={`${card.href}-${i}`}
              href={card.href}
              className="studio-card"
              style={{ ["--tint" as string]: card.tint }}
            >
              <span className="studio-card-glow" aria-hidden />
              <span className="studio-card-title">{card.title}</span>
              <span className="studio-card-kind">{card.kind}</span>
              <span className="studio-card-excerpt">{card.excerpt}</span>
              <span className="studio-card-foot">
                <GitBranch aria-hidden />
                {card.links} links
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
