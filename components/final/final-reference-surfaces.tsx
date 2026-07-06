// Reference-scaffold surfaces for the /final boards: keyboard shortcuts, split
// editor, command palette. specialReferenceSurface is the single entry point
// consumed by FinalPackScreen.
import type { ReactNode } from "react";
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { ReferenceShell, ReferenceStage } from "@/components/final/final-primitives";
import {
  DarkReaderSurface,
  HomeReferenceContent,
  ResponsiveDeviceSurface,
} from "@/components/final/final-reference-mockups";

function KeyboardShortcutsSurface() {
  return (
    <ReferenceStage>
      <ReferenceShell active="Home">
        <HomeReferenceContent
          overlay={
            <div className="final-ref-backdrop">
              <div className="final-ref-modal">
                <div className="final-ref-section-head">
                  <h2>Keyboard Shortcuts</h2>
                  <button type="button">×</button>
                </div>
                <div className="final-ref-input">Search shortcuts…</div>
                <div className="final-ref-kbd-list">
                  {[
                    ["Command Palette", "⌘ K"],
                    ["Quick Open", "⌘ P"],
                    ["Toggle Sidebar", "⌘ /"],
                    ["Global Search", "⌘ F"],
                    ["Save", "⌘ S"],
                    ["Left / Right Split", "⌘ ⇧ \\"],
                    ["Ask Agent", "⌘ Enter"],
                  ].map(([label, key]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        />
      </ReferenceShell>
    </ReferenceStage>
  );
}

const mdxLines = [
  "  1  ---",
  "  2  title: Agent-native Workflows",
  "  3  description: Designing knowledge work that thinks with you.",
  "  4  status: published",
  "  5  tags: [agent, workflows, design]",
  "  6  ---",
  "  7",
  "  8  # Agent-native Workflows",
  "  9",
  " 10  Designing knowledge work that thinks with you.",
  " 11",
  ' 12  <Callout type="info" title="Core Idea">',
  " 13    Give the agent context, not just questions.",
  " 14  </Callout>",
  " 15",
  " 16  ## What is Agent-native?",
  " 17",
  " 18  Agent-native means the agent is more than a chatbot.",
  " 19  It understands your workspace, your tools, and your goals.",
];

function SplitEditorContent({ overlay }: { overlay?: ReactNode }) {
  return (
    <>
      <div className="final-ref-mode">
        <span>Read</span>
        <span>Edit</span>
        <span className="is-active">Split</span>
      </div>
      <div className="final-ref-editor-split">
        <section className="final-ref-card is-editor">
          <div className="final-ref-editor-toolbar">
            Agent-native Workflows.mdx <span>MDX ▾</span>
          </div>
          <pre>{mdxLines.join("\n")}</pre>
        </section>
        <section className="final-ref-card is-preview">
          <h1>Agent-native Workflows</h1>
          <p>Designing knowledge work that thinks with you.</p>
          <div className="final-ref-callout">
            <strong>Core Idea</strong>
            <br />
            Give the agent context, not just questions.
          </div>
          <h2>What is Agent-native?</h2>
          <p>
            Agent-native means the agent is more than a chatbot. It understands your workspace, your
            tools, and your goals.
          </p>
          <h2>Core Principles</h2>
          <ol>
            <li>Context is everything</li>
            <li>Reasoning is visible</li>
            <li>Actions are safe</li>
            <li>You stay in control</li>
          </ol>
        </section>
      </div>
      {overlay}
    </>
  );
}

function EditorReferenceSurface({ item }: { item: FinalPackItem }) {
  const isCommand = item.id.includes("command-palette");
  return (
    <ReferenceStage>
      <ReferenceShell active="Library">
        <SplitEditorContent
          overlay={
            <div className="final-ref-backdrop">
              <div className="final-ref-modal">
                {isCommand ? (
                  <>
                    <div className="final-ref-section-head">
                      <h2>Command Palette</h2>
                      <button type="button">×</button>
                    </div>
                    <div className="final-ref-input">Type a command…</div>
                    {[
                      ["Format Document", ""],
                      ["Fix All Problems", ""],
                      ["Insert Table", ""],
                      ["Insert Callout", ""],
                      ["Toggle Split View", "⌘ \\"],
                      ["Go to Symbol", "⌘ T"],
                      ["Find in Files", "⌘ ⇧ F"],
                    ].map(([label, shortcut]) => (
                      <div key={label} className="final-ref-row">
                        <span>{label}</span>
                        <small>{shortcut}</small>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="final-ref-section-head">
                      <h2>New</h2>
                      <button type="button">×</button>
                    </div>
                    <div className="final-ref-tabs">
                      <span className="is-active">Document</span>
                      <span>Folder</span>
                    </div>
                    {[
                      ["Name", "new-document.mdx"],
                      ["Location", "Verto Handbook / Editor Mode"],
                      ["Template", "Standard MDX ▾"],
                    ].map(([label, value]) => (
                      <label key={label} className="final-ref-field">
                        <span>{label}</span>
                        <div>{value}</div>
                      </label>
                    ))}
                    <div className="final-ref-actions is-end">
                      <button type="button">Cancel</button>
                      <button type="button" className="is-primary">
                        Create
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          }
        />
      </ReferenceShell>
    </ReferenceStage>
  );
}

export function specialReferenceSurface(item: FinalPackItem): ReactNode | null {
  if (
    item.id === "12_responsive-desktop" ||
    item.id === "13_responsive-tablet" ||
    item.id === "14_responsive-mobile"
  ) {
    return <ResponsiveDeviceSurface item={item} />;
  }
  if (item.id === "19_dark-mode-preview") return <DarkReaderSurface />;
  if (item.id === "20_keyboard-shortcuts") return <KeyboardShortcutsSurface />;
  if (item.id === "46_editor-new-document" || item.id === "48_editor-command-palette") {
    return <EditorReferenceSurface item={item} />;
  }
  return null;
}
