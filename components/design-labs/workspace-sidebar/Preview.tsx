"use client";
import { useState } from "react";
import { ArrowUpRight, ClipboardCheck, Layers, PanelLeft } from "lucide-react";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspacePreview() {
  const [selected, setSelected] = useState("Tasks");
  return (
    <div className="workspace-experiment">
      <div className="app-shell">
        <WorkspaceSidebar selected={selected} onSelect={setSelected} />
        <main className="main-content">
          <header className="content-header">
            <ClipboardCheck size={17} />
            <span>{selected}</span>
            <span className="header-divider">/</span>
            <span className="header-muted">Workspace</span>
            <span className="preview-label">COMPONENT PREVIEW</span>
          </header>
          <div className="canvas">
            <div className="experiment-meta">
              <span className="lab-symbol">
                <Layers size={16} />
              </span>
              <span>DESIGN LABS</span>
              <span className="meta-line" />
              <span>EXPERIMENT 001</span>
            </div>
            <div className="experiment-copy">
              <div className="component-symbol">
                <PanelLeft size={27} strokeWidth={1.3} />
              </div>
              <p className="eyebrow">A STUDY IN NAVIGATION</p>
              <h1>
                A place for
                <br />
                everything.
              </h1>
              <p className="description">
                A quiet sidebar for a busy workspace.
                <br />
                Two layers. Clear hierarchy. Room to focus.
              </p>
              <div className="current-location">
                <span className="status-dot" />
                <span>{selected}</span>
                <ArrowUpRight size={14} />
              </div>
            </div>
            <footer className="canvas-footer">
              <span>01 — Workspace sidebar</span>
              <span>
                React <i /> TypeScript <i /> CSS
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
