import { ChevronDown, GitBranch, GitCommit, Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";

export const metadata = { title: "Git Changes" };

const FILES = [
  { path: "docs/agent-workflow-principles.md", badge: "M", active: true },
  { path: "docs/architecture/overview.md", badge: "M" },
  { path: "docs/architecture/data-model.md", badge: "M" },
  { path: "docs/architecture/components.md", badge: "M" },
  { path: "guides/getting-started.md", badge: "M" },
  { path: "src/agents/workflow/runner.ts", badge: "M" },
  { path: "tests/workflow/runner.test.ts", badge: "M" },
];

const DIFF_LINES: Array<{ ln: number; kind: "ctx" | "add" | "del"; text: string }> = [
  { ln: 12, kind: "ctx", text: "Agents should be transparent about their reasoning" },
  { ln: 13, kind: "ctx", text: "Users stay in control of important decisions" },
  { ln: 14, kind: "ctx", text: "" },
  { ln: 15, kind: "add", text: "## Workflow Lifecycle" },
  { ln: 16, kind: "add", text: "" },
  { ln: 17, kind: "add", text: "1. **Plan** — Define success criteria" },
  { ln: 18, kind: "add", text: "2. **Execute** — Use tools" },
  { ln: 19, kind: "add", text: "3. **Review** — Validate results" },
  { ln: 20, kind: "ctx", text: "" },
  { ln: 21, kind: "ctx", text: "" },
  { ln: 22, kind: "del", text: "## Principles" },
];

export default function GitPage() {
  const active = FILES.find((f) => f.active) ?? FILES[0];
  return (
    <>
      <PageHeader
        title="Git Changes"
        subtitle="Review and commit your changes to your knowledge workspace."
        tools={
          <>
            <button type="button" className="v-btn v-btn--sm">
              <GitBranch aria-hidden /> main <ChevronDown aria-hidden />
            </button>
            <button type="button" className="v-btn v-btn--sm" aria-label="Add">
              <Plus aria-hidden />
            </button>
          </>
        }
      />
      <PageTabs tabs={["Changes 8", "Staged 3"]} />

      <div className="git-shell">
        <aside className="git-files" aria-label="Changed files">
          <ul className="git-files-list">
            {FILES.map((f) => (
              <li key={f.path} className={`git-file${f.active ? " is-active" : ""}`}>
                <span className="git-file-path">{f.path}</span>
                <span className="git-file-badge">{f.badge}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="git-diff-panel">
          <header className="git-diff-head">
            <span className="git-diff-path">{active.path}</span>
            <span className="git-diff-stats">+14</span>
          </header>
          <div className="git-diff-body">
            {DIFF_LINES.map((line, i) => (
              <div key={i} className={`git-diff-line is-${line.kind}`}>
                <span className="git-diff-ln">{line.ln}</span>
                <span className="git-diff-marker" aria-hidden>
                  {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
                </span>
                <span className="git-diff-text">{line.text || "\u00A0"}</span>
              </div>
            ))}
          </div>
          <footer className="git-commit">
            <label htmlFor="git-commit-msg" className="git-commit-label">
              Commit message
            </label>
            <input
              id="git-commit-msg"
              type="text"
              className="git-commit-input"
              defaultValue="docs: add workflow lifecycle and update principles"
            />
            <button type="button" className="v-btn v-btn--primary git-commit-btn">
              <GitCommit aria-hidden /> Commit & Push
            </button>
          </footer>
        </section>
      </div>
    </>
  );
}
