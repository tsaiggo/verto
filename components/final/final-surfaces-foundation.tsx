// /final product surfaces: foundation/design-system + generic fallback.
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { Card, Header, Tabs } from "@/components/final/final-primitives";
import { Related } from "@/components/final/final-surfaces-library";

function DesignTokensBoard() {
  return (
    <div className="final-card-grid">
      <Card title="Color tokens">
        <p>Neutral base + minimal semantic accents. Hex → CSS variable.</p>
        <div className="final-token-row">
          <span style={{ background: "#fafafa", border: "1px solid #e6e6e2" }} />
          <span style={{ background: "#ffffff", border: "1px solid #e6e6e2" }} />
          <span style={{ background: "#f5f5f3" }} />
          <span style={{ background: "#0f1115" }} />
          <span style={{ background: "#6b6f76" }} />
          <span style={{ background: "#2563eb" }} />
          <span style={{ background: "#16a34a" }} />
          <span style={{ background: "#dc2626" }} />
        </div>
        <small>bg · surface · subtle · text · muted · accent · success · error</small>
      </Card>
      <Card title="Typography">
        <p>Inter (sans) + JetBrains Mono (mono). No decorative faces.</p>
        <div className="final-stack compact">
          <div style={{ fontSize: 22, fontWeight: 700 }}>H1 · 22 / 700</div>
          <div style={{ fontSize: 16, fontWeight: 650 }}>H2 · 16 / 650</div>
          <div style={{ fontSize: 13, color: "#6b6f76" }}>Body · 13 / 400 · muted</div>
          <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
            Mono · 12 · JetBrains
          </div>
        </div>
      </Card>
      <Card title="Spacing scale">
        <div className="final-stack compact">
          <div>4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64</div>
          <small>Every gap/padding rounds to nearest scale value.</small>
        </div>
      </Card>
      <Card title="Radius scale">
        <div className="final-stack compact">
          <div>0 · 2 · 4 · 6 · 8 · 12 · 18 · 24 · 999 (pill)</div>
          <small>Pills use 999px. No large numeric radii.</small>
        </div>
      </Card>
      <Card title="Elevation">
        <p>Flat by design. 1px border is the elevation.</p>
        <small>Cards: outline only · Modals/popovers: soft shadow allowed</small>
      </Card>
      <Card title="Desktop panels">
        <div className="final-stack compact">
          <div>Primary nav · 64</div>
          <div>Sources rail · 240–280</div>
          <div>Document tree · 280–340</div>
          <div>Context rail · 320–360</div>
          <div>Top bar · 56 · Status bar · 28</div>
        </div>
      </Card>
    </div>
  );
}

function ComponentLibraryBoard() {
  return (
    <div className="final-card-grid">
      <Card title="Buttons">
        <div className="final-actions">
          <button type="button" className="final-btn final-btn-primary">
            Primary
          </button>
          <button type="button" className="final-btn">
            Secondary
          </button>
          <button type="button" className="final-btn" disabled>
            Disabled
          </button>
        </div>
      </Card>
      <Card title="Pills / tags">
        <div className="final-actions">
          <span className="final-pill">Default</span>
          <span className="final-pill is-synced">Synced</span>
          <span className="final-pill is-error">Error</span>
          <span className="final-pill is-pending">Pending</span>
        </div>
      </Card>
      <Card title="Inputs">
        <div className="final-stack compact">
          <div className="final-ref-input">Enter text…</div>
          <div className="final-ref-input">github.com/owner/repo</div>
        </div>
      </Card>
      <Card title="Cards">
        <p className="final-lede">A 1px bordered surface holds one primary content chunk.</p>
        <small>Section title, divider, body, optional footer actions.</small>
      </Card>
      <Card title="Tabs">
        <Tabs labels={["Read", "Edit", "Split"]} active={1} />
      </Card>
      <Card title="Status">
        <div className="final-stack compact">
          <div className="final-row">
            <span>
              <strong>Success</strong>
              <small>Change applied</small>
            </span>
            <span className="final-pill is-synced">OK</span>
          </div>
          <div className="final-row">
            <span>
              <strong>Warning</strong>
              <small>Large file</small>
            </span>
            <span className="final-pill is-pending">Wait</span>
          </div>
          <div className="final-row">
            <span>
              <strong>Error</strong>
              <small>Sync failed</small>
            </span>
            <span className="final-pill is-error">Fail</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AppShellAnatomyBoard() {
  return (
    <div className="final-two">
      <Card title="Desktop shell regions">
        <div className="final-stack">
          {[
            ["Primary nav", "64px · icon-only rail"],
            ["Sources rail", "240–280px · contextual"],
            ["Document tree", "280–340px · file tree"],
            ["Context rail", "320–360px · Outline / Notes / Links / Agent"],
            ["Top bar", "56px · search + user"],
            ["Status bar", "28px · optional footer"],
          ].map(([label, meta]) => (
            <div key={label} className="final-row">
              <span>
                <strong>{label}</strong>
                <small>{meta}</small>
              </span>
              <span className="final-pill">Fixed</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Rules">
        <div className="final-stack compact">
          <div>Primary nav is always visible.</div>
          <div>The document is the primary visual object.</div>
          <div>Context rail order is fixed: Outline / Notes / Links / Agent.</div>
          <div>Top bar never stacks multiple rows.</div>
          <div>Modes are Read / Edit / Split only.</div>
        </div>
      </Card>
    </div>
  );
}

function DesignSystemReferenceBoard() {
  return (
    <div className="final-card-grid">
      <Card title="Color tokens">
        <div className="final-token-row">
          <span style={{ background: "#fafafa", border: "1px solid #e6e6e2" }} />
          <span style={{ background: "#ffffff", border: "1px solid #e6e6e2" }} />
          <span style={{ background: "#f5f5f3" }} />
          <span style={{ background: "#0f1115" }} />
          <span style={{ background: "#6b6f76" }} />
          <span style={{ background: "#2563eb" }} />
          <span style={{ background: "#16a34a" }} />
        </div>
        <small>bg · surface · subtle · text · muted · accent · success</small>
      </Card>
      <Card title="Typography">
        <div className="final-stack compact">
          <div style={{ fontSize: 20, fontWeight: 700 }}>Display · 20 / 700</div>
          <div style={{ fontSize: 15, fontWeight: 650 }}>Section · 15 / 650</div>
          <div style={{ fontSize: 13, color: "#6b6f76" }}>Body · 13 · muted</div>
        </div>
      </Card>
      <Card title="Buttons">
        <div className="final-actions">
          <button type="button" className="final-btn final-btn-primary">
            Primary
          </button>
          <button type="button" className="final-btn">
            Secondary
          </button>
        </div>
      </Card>
      <Card title="Cards & states">
        <p className="final-lede">A neutral surface with a thin border. No shadow-based elevation.</p>
        <div className="final-actions">
          <span className="final-pill is-synced">Synced</span>
          <span className="final-pill is-pending">Pending</span>
          <span className="final-pill is-error">Error</span>
        </div>
      </Card>
      <Card title="Foundations">
        <div className="final-stack compact">
          <div>Spacing: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64</div>
          <div>Radius: 0 · 2 · 4 · 6 · 8 · 12 · 18 · 24</div>
          <div>Elevation: flat (1px border)</div>
        </div>
      </Card>
      <Card title="Component library">
        <div className="final-stack compact">
          <div>Cards · Buttons · Pills · Inputs · Tabs</div>
          <div>Search prompt · Toggle · Diff row</div>
          <div>Heatmap cell · Stat card · Result row</div>
        </div>
      </Card>
    </div>
  );
}

export function FoundationSurface({ item }: { item: FinalPackItem }) {
  const board =
    item.id === "21_design-tokens" ? (
      <DesignTokensBoard />
    ) : item.id === "22_component-library" ? (
      <ComponentLibraryBoard />
    ) : item.id === "23_app-shell-anatomy" ? (
      <AppShellAnatomyBoard />
    ) : (
      <DesignSystemReferenceBoard />
    );
  return (
    <>
      <Header item={item} />
      {board}
    </>
  );
}

export function GenericSurface({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-two">
        <Card title="Reference coverage">
          <p className="final-lede">{item.notes}</p>
          <div className="final-stack">
            {["Primary view", "State handling", "Actions", "Responsive behavior"].map((row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>{item.state}</small>
                </span>
                <span className="final-pill">Covered</span>
              </div>
            ))}
          </div>
        </Card>
        <Related item={item} />
      </div>
    </>
  );
}
