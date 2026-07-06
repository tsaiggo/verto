// /final product surfaces: git status, settings, onboarding/state.
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { gitFiles } from "@/components/final/final-fixtures";
import { Card, Header, Tabs } from "@/components/final/final-primitives";

export function GitSurface({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <Tabs
        labels={["Changes 8", "Diff", "Commit", "Branches", "Conflicts"]}
        active={gitTab(item)}
      />
      <div className="final-two">
        <Card title="Changed files">
          {gitFiles.map(([file, badge, count]) => (
            <div key={file} className="final-row">
              <span>
                <strong>{file}</strong>
                <small>{count}</small>
              </span>
              <span className="final-pill">{badge}</span>
            </div>
          ))}
        </Card>
        <Card title={item.title}>
          <div className="final-split-diff">
            <div className="final-diff">
              <span>Current</span>
              <span className="del">- Capture context</span>
              <span>- Propose actions</span>
            </div>
            <div className="final-diff">
              <span>Working directory</span>
              <span className="add">+ Capture context</span>
              <span className="add">+ Require approval</span>
              <span>+ Apply safely</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function gitTab(item: FinalPackItem) {
  if (item.id.includes("diff")) return 1;
  if (item.id.includes("commit")) return 2;
  if (item.id.includes("branches")) return 3;
  if (item.id.includes("conflict")) return 4;
  return 0;
}

export function SettingsSurface({ item }: { item: FinalPackItem }) {
  const sections = [
    "General",
    "Appearance",
    "Editor",
    "Reading",
    "AI & Agent",
    "Privacy",
    "Shortcuts",
    "About",
  ];
  const active = Math.max(
    0,
    sections.findIndex((label) =>
      item.title.toLowerCase().includes(label.split(" ")[0].toLowerCase())
    )
  );
  return (
    <>
      <Header item={item} />
      <div className="final-settings">
        <nav>
          {sections.map((section, i) => (
            <span key={section} className={i === active ? "is-active" : ""}>
              {section}
            </span>
          ))}
        </nav>
        <div>
          <Card title={sections[active]}>
            <div className="final-stack">
              {[
                "Workspace behavior",
                "Default source",
                "Keyboard-first commands",
                "Local data ownership",
              ].map((row, i) => (
                <div key={row} className="final-row">
                  <span>
                    <strong>{row}</strong>
                    <small>{item.notes}</small>
                  </span>
                  <span className={`final-switch${i % 2 === 0 ? " is-on" : ""}`} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export function StateSurface({ item }: { item: FinalPackItem }) {
  const loading = item.state === "Loading" || item.state === "Progress";
  return (
    <>
      <Header item={item} />
      <div className="final-state-layout">
        <div className="final-state-card">
          <span className="final-state-icon">{stateIcon(item)}</span>
          <h2>{item.title}</h2>
          <p>{item.notes}</p>
          {loading ? (
            <div className="final-progress">
              <span style={{ width: item.state === "Progress" ? "62%" : "42%" }} />
            </div>
          ) : null}
          <div className="final-actions">
            <button className="final-btn">Learn more</button>
            <button className="final-btn final-btn-primary">{primaryStateAction(item)}</button>
          </div>
        </div>
        <Card title="What stays available">
          <div className="final-stack compact">
            {[
              "Local reading",
              "Search cached documents",
              "Open recent files",
              "Manage settings",
            ].map((row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>Available offline or locally</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function stateIcon(item: FinalPackItem) {
  if (item.state === "Error" || item.state === "Blocked") return "!";
  if (item.state === "Warning") return "?";
  if (item.state === "Loading" || item.state === "Progress") return "...";
  if (item.state.includes("Step")) return ">";
  return "+";
}

function primaryStateAction(item: FinalPackItem) {
  if (item.id.includes("onboarding")) return "Continue";
  if (item.state === "Error") return "Retry";
  if (item.state === "Blocked") return "Reconnect";
  if (item.state === "Warning") return "Open anyway";
  return "Take action";
}
