import { File, FileText, MoreHorizontal, Save } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";

export const metadata = { title: "Editor Mode" };

const FILES = [
  { name: "Agent-native Workflows.mdx", active: true },
  { name: "Key Features.mdx" },
  { name: "Designing AI Products.mdx" },
  { name: "Multi-source RAG Notes.md" },
];

const FRONTMATTER = [
  { key: "title", value: "Agent-native Workflows" },
  { key: "description", value: "Designing knowledge work that thinks with you." },
  { key: "status", value: "published" },
  { key: "tags", value: "agent · workflows · design" },
  { key: "updated", value: "2025-05-24" },
];

const SOURCE_LINES = [
  "---",
  "title: Agent-native Workflows",
  "description: Designing knowledge work that thinks with you.",
  "status: published",
  "tags: [agent, workflows, design]",
  "---",
  "",
  "# Agent-native Workflows",
  "",
  "Designing knowledge work that thinks with you.",
  "",
  '<Callout type="info" title="Core Idea">',
  "  Give the agent context, not just questions.",
  "</Callout>",
  "",
  "## What is Agent-native?",
  "",
  "Agent-native means the agent is more than a chatbot.",
  "It understands your workspace, your tools, and your goals.",
];

export default function EditorPage() {
  const active = FILES.find((f) => f.active) ?? FILES[0];
  return (
    <>
      <PageHeader
        title="Editor"
        subtitle="MDX authoring with source, preview and status."
        tools={
          <>
            <span className="ed-saved">
              <Save aria-hidden /> Saved
            </span>
            <button type="button" className="v-btn v-btn--sm" aria-label="More">
              <MoreHorizontal aria-hidden />
            </button>
          </>
        }
      />

      <div className="ed-shell">
        <aside className="ed-files" aria-label="Files">
          <div className="ed-files-head">
            <span>Files</span>
          </div>
          <ul className="ed-files-list">
            {FILES.map((f) => (
              <li key={f.name} className={`ed-file${f.active ? " is-active" : ""}`}>
                <FileText aria-hidden className="ed-file-icon" />
                <span>{f.name}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="ed-main">
          <div className="ed-tabbar">
            <div className="ed-tab is-active">
              <File aria-hidden />
              <span>{active.name}</span>
            </div>
          </div>
          <div className="ed-source">
            {SOURCE_LINES.map((line, i) => (
              <div key={i} className="ed-source-line">
                <span className="ed-source-ln">{i + 1}</span>
                <span className="ed-source-code">{line || "\u00A0"}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="ed-inspector" aria-label="Frontmatter">
          <PageTabs tabs={["Frontmatter", "Outline", "Components", "Problems"]} />
          <dl className="ed-frontmatter">
            {FRONTMATTER.map((row) => (
              <div key={row.key} className="ed-frontmatter-row">
                <dt>{row.key}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
