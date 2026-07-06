// /final product surfaces: editor & MDX authoring.
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { Tabs } from "@/components/final/final-primitives";

export function EditorSurface({ item }: { item: FinalPackItem }) {
  return (
    <div className="final-editor-shell">
      <aside className="final-doc-tree">
        <strong>Verto Handbook</strong>
        {["01 Introduction", "02 Key Concepts", "03 Editor Mode", "callout.mdx", "tabs.mdx"].map(
          (doc, i) => (
            <span key={doc} className={i === 2 ? "is-active" : ""}>
              {doc}
            </span>
          )
        )}
      </aside>
      <section className="final-editor-main">
        <Tabs labels={["Read", "Edit", "Split"]} active={item.id.includes("split") ? 2 : 1} />
        <div className="final-editor-tabs">
          <span>getting-started.mdx</span>
          <span className="is-active">editor-mode.mdx*</span>
          <span>callout.mdx</span>
        </div>
        <div className="final-code">
          {[
            "---",
            "title: Editor Mode",
            "tags: [mdx, authoring, components]",
            "---",
            "",
            "# Editor Mode",
            "",
            "Use Edit mode to author documents with speed and confidence.",
            "",
            '<Callout type="info" title="Live by default">',
            "  Every change updates the preview instantly.",
            "</Callout>",
          ].map((line, index) => (
            <div key={`${line}-${index}`}>
              <span>{index + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </div>
        {editorOverlay(item)}
      </section>
      <aside className="final-preview">
        <h2>Editor Mode</h2>
        <p>Author rich MDX, preview components and keep problems visible.</p>
        <div className="final-callout">Live preview updates as the source changes.</div>
      </aside>
    </div>
  );
}

function editorOverlay(item: FinalPackItem) {
  if (item.id.includes("component-inserter")) {
    return (
      <div className="final-floating-menu">
        {["Callout", "Tabs", "Mermaid", "Table"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    );
  }
  if (item.id.includes("problems")) {
    return (
      <div className="final-bottom-panel">
        3 problems: unknown prop, missing alt text, invalid heading order.
      </div>
    );
  }
  if (item.id.includes("save-failed")) {
    return <div className="final-toast is-error">Save failed. Retry or save a copy.</div>;
  }
  if (item.id.includes("version-history")) {
    return <div className="final-side-pop">Version history: 2m ago, 1h ago, yesterday.</div>;
  }
  if (item.id.includes("new-document")) {
    return (
      <div className="final-modal">
        <h2>New document</h2>
        <input defaultValue="agent-native-workflows.mdx" />
        <button className="final-btn final-btn-primary">Create</button>
      </div>
    );
  }
  if (item.id.includes("context-menu")) {
    return (
      <div className="final-floating-menu is-small">
        {["Rename", "Move", "Duplicate", "Delete"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    );
  }
  if (item.id.includes("command-palette")) {
    return (
      <div className="final-modal">
        <h2>Command palette</h2>
        <input defaultValue="Insert component" />
        <p>Open file, Toggle split, Run agent summary</p>
      </div>
    );
  }
  if (item.id.includes("unsaved")) {
    return <div className="final-toast">Unsaved changes. Autosave paused.</div>;
  }
  return null;
}
