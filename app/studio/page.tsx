import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Folder,
  LayoutGrid,
  MoreHorizontal,
  Notebook,
  Plus,
  Rows3,
  Search,
  Sparkles,
} from "lucide-react";

export const metadata = { title: "Editor Mode & MDX Authoring" };

const sourceTabs = ["getting-started.mdx", "editor-mode.mdx", "callout.mdx", "tabs.mdx"];

const editorLines = [
  "---",
  "title: Editor Mode & MDX Authoring",
  "description: Author and edit MDX with live preview,",
  "rich components, and powerful tooling.",
  "tags: [mdx, editor, authoring, components]",
  "status: published",
  "updatedAt: 2025-05-07",
  "---",
  "",
  "# Editor Mode",
  "",
  "Verto is a **reader-editor for MDX**, not just a chat UI.",
  "",
  "Use Edit mode to author documents with speed and confidence.",
  "",
  "<Callout type=\"info\" title=\"Live by default\">",
  "  Every change updates the preview instantly.",
  "  Autosave keeps your work safe.",
  "</Callout>",
  "",
  "## Key Capabilities",
  "- Syntax highlighting",
  "- Component inserter",
  "- Frontmatter editor",
  "- Live preview & TOC",
  "- Problems & quick fixes",
  "",
  "<Tabs defaultValue=\"source\">",
  "  <Tab value=\"source\" label=\"MDX Source\">",
  "    ```tsx",
  "    export function Badge({ tone = \"neutral\", children }) {",
  "      return <span className={`badge tone-${tone}`}>{children}</span>",
  "    }",
  "    ```",
  "  </Tab>",
  "  <Tab value=\"preview\" label=\"Preview\">",
  "    <Badge tone=\"success\">Ready</Badge>",
  "  </Tab>",
  "</Tabs>",
  "",
  "## Diagram (Mermaid)",
  "```mermaid",
  "flowchart LR",
  "  A[Author] --> B[Write MDX] --> C{Preview} --> D[Publish]",
  "```",
];

const tree = [
  {
    name: "Verto Handbook",
    open: true,
    children: [
      { name: "_meta", muted: true },
      { name: "01 — Introduction" },
      { name: "02 — Key Concepts" },
      { name: "03 — Editor Mode", active: true },
      { name: "04 — Components", expandable: true },
      { name: "callout.mdx", depth: 2 },
      { name: "tabs.mdx", depth: 2 },
      { name: "05 — References" },
      { name: "changelog.mdx" },
      { name: "CONTRIBUTING.mdx" },
    ],
  },
  { name: "Design System", open: false, children: [] },
  { name: "SDK Examples", open: false, children: [] },
  { name: "Research", open: false, children: [] },
];

const componentBlocks = [
  ["Callout", "Note, tip, info, warning"],
  ["Tabs", "Tabbed content groups"],
  ["Mermaid", "Diagrams with Mermaid code"],
  ["d2 Diagram", "Structured architecture"],
  ["Excalidraw", "Hand-drawn diagrams"],
  ["Embed", "GitHub, Figma, Loom"],
  ["Compare", "Side-by-side diffs"],
  ["Table", "Structured tables"],
];

export default function StudioPage() {
  return (
    <section className="editor-authoring-page" aria-label="Editor Mode and MDX Authoring">
      <aside className="editor-workspace-rail" aria-label="Workspace documents">
        <div className="editor-rail-top">
          <div className="editor-mode-pill is-active">
            <Braces aria-hidden />
            Editor
          </div>
          <button type="button" className="editor-icon-button" aria-label="New document">
            <Plus aria-hidden />
          </button>
        </div>

        <label className="editor-search">
          <Search aria-hidden />
          <span>Library</span>
        </label>

        <div className="editor-workspace-selector">
          <span>Workspaces</span>
          <ChevronDown aria-hidden />
        </div>

        <div className="editor-tree">
          {tree.map((group) => (
            <div key={group.name} className="editor-tree-group">
              <div className={`editor-tree-folder${group.open ? " is-open" : ""}`}>
                <Folder aria-hidden />
                <span>{group.name}</span>
                {group.open && <ChevronDown aria-hidden className="editor-tree-chevron" />}
              </div>
              {group.children.map((item) => (
                <div
                  key={item.name}
                  className={`editor-tree-file${item.active ? " is-active" : ""}${
                    item.muted ? " is-muted" : ""
                  }${item.depth ? " is-nested" : ""}`}
                >
                  {item.expandable ? (
                    <ChevronDown aria-hidden className="editor-tree-caret" />
                  ) : (
                    <FileText aria-hidden />
                  )}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="editor-rail-footer">
          <button type="button">
            <Plus aria-hidden />
            New
          </button>
          <button type="button" aria-label="Search documents">
            <Search aria-hidden />
          </button>
        </div>
      </aside>

      <div className="editor-workbench">
        <div className="editor-topbar">
          <div className="editor-mode-switch" role="group" aria-label="Editor mode">
            <button type="button">Reader</button>
            <button type="button" className="is-active">
              Edit
            </button>
            <button type="button">Split</button>
          </div>
        </div>
        <header className="editor-tabs-bar" aria-label="Open MDX files">
          {sourceTabs.map((tab, index) => (
            <div key={tab} className={`editor-file-tab${index === 1 ? " is-active" : ""}`}>
              {index === 1 ? (
                <span className="editor-tab-dirty" aria-hidden />
              ) : (
                <FileText aria-hidden />
              )}
              <span>{tab}</span>
              <span className="editor-tab-close">×</span>
            </div>
          ))}
          <button type="button" className="editor-tab-add" aria-label="Open file">
            <Plus aria-hidden />
          </button>
          <div className="editor-autosave">
            <span className="editor-dot is-green" />
            Autosaved 2s ago
            <ChevronDown aria-hidden />
          </div>
          <button type="button" className="editor-icon-button" aria-label="Sync">
            <Copy aria-hidden />
          </button>
          <button type="button" className="editor-icon-button" aria-label="More">
            <MoreHorizontal aria-hidden />
          </button>
        </header>

        <div className="editor-split">
          <div className="editor-code-pane" aria-label="MDX source editor">
            <div className="editor-code-scroll">
              {editorLines.map((line, index) => (
                <div key={`${line}-${index}`} className="editor-code-line">
                  <span className="editor-line-number">{index + 1}</span>
                  <code>{line || " "}</code>
                </div>
              ))}
            </div>
            <div className="editor-component-popover">
              <div className="editor-component-title">Insert MDX component</div>
              {componentBlocks.map(([name, desc], index) => (
                <button key={name} type="button" className="editor-component-option">
                  <span className={`editor-component-icon tone-${index % 5}`}>
                    {name === "Tabs" ? (
                      <Rows3 aria-hidden />
                    ) : name === "Table" ? (
                      <LayoutGrid aria-hidden />
                    ) : name === "Mermaid" ? (
                      <Sparkles aria-hidden />
                    ) : (
                      <Notebook aria-hidden />
                    )}
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{desc}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <article className="editor-preview-pane" aria-label="Live MDX preview">
            <div className="editor-preview-wrap">
              <h1>Editor Mode</h1>
              <p className="editor-preview-lede">
                Verto is a reader-editor for MDX, not just a chat UI.
              </p>
              <p>Use Edit mode to author documents with speed and confidence.</p>

              <div className="editor-preview-callout">
                <CheckCircle2 aria-hidden />
                <div>
                  <strong>Live by default</strong>
                  <p>Every change updates the preview instantly.</p>
                  <span>Autosave keeps your work safe.</span>
                </div>
              </div>

              <h2>Key Capabilities</h2>
              <ul>
                <li>Syntax highlighting</li>
                <li>Component inserter</li>
                <li>Frontmatter editor</li>
                <li>Live preview & TOC</li>
                <li>Problems & quick fixes</li>
              </ul>

              <div className="editor-preview-tabs">
                <span className="is-active">MDX Source</span>
                <span>Preview</span>
              </div>
              <pre className="editor-preview-code">{`export function Badge({ tone = "neutral", children }) {
  return <span className={\`badge tone-${"${tone}"}\`}>{children}</span>
}`}</pre>
              <span className="editor-ready-badge">Ready</span>

              <h2>Diagram (Mermaid)</h2>
              <div className="editor-diagram" aria-label="Author to publish flow">
                <span>Author</span>
                <i />
                <span>Write MDX</span>
                <i />
                <span>Preview</span>
                <i />
                <span>Publish</span>
              </div>
            </div>
          </article>
        </div>

        <footer className="editor-statusbar" aria-label="Editor status">
          <span>Verto Handbook</span>
          <span>/</span>
          <span>03 — Editor Mode</span>
          <span>/</span>
          <strong>editor-mode.mdx</strong>
          <span className="editor-status-spacer" />
          <span>MDX</span>
          <span>LF</span>
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <span>100%</span>
        </footer>
      </div>

      <aside className="editor-utility-rail" aria-label="Editor utilities">
        {["Frontmatter", "Outline", "Components", "Problems", "History", "Preview"].map((label, i) => (
          <button key={label} type="button" className={i === 0 ? "is-active" : ""} aria-label={label}>
            {i === 3 ? <AlertTriangle aria-hidden /> : i === 1 ? <Rows3 aria-hidden /> : <FileText aria-hidden />}
          </button>
        ))}
      </aside>

      <aside className="editor-inspector" aria-label="Frontmatter inspector">
        <div className="editor-inspector-tabs">
          <span className="is-active">Frontmatter</span>
          <span>Outline</span>
          <span>Components</span>
          <span>Problems</span>
        </div>

        <div className="editor-field">
          <label>
            title <span className="editor-req">*</span>
          </label>
          <input value="Editor Mode & MDX Authoring" readOnly />
        </div>
        <div className="editor-field">
          <label>description</label>
          <textarea value="Author and edit MDX with live preview, rich components, and powerful tooling." readOnly />
        </div>
        <div className="editor-field">
          <label>tags</label>
          <div className="editor-tags">
            {["mdx", "editor", "authoring", "components"].map((tag) => (
              <span key={tag}>{tag} ×</span>
            ))}
          </div>
        </div>
        <div className="editor-field">
          <label>status</label>
          <button type="button" className="editor-select">
            published <ChevronDown aria-hidden />
          </button>
        </div>
        <div className="editor-field">
          <label>updatedAt</label>
          <input value="2025-05-07" readOnly />
        </div>
        <div className="editor-field">
          <label>authors</label>
          <input value="Add author..." readOnly />
        </div>

        <div className="editor-draft-row">
          <span>draft</span>
          <span className="editor-toggle" aria-hidden />
        </div>

        <details className="editor-custom-fields">
          <summary>Custom fields</summary>
        </details>
      </aside>
    </section>
  );
}
