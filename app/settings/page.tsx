import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Database,
  FileText,
  GitBranch,
  Keyboard,
  Lock,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  Trash2,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import SpecBoardHeader from "@/components/spec-board/SpecBoardHeader";
import SpecBoardPageShell from "@/components/spec-board/SpecBoardPageShell";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";
import SpecBoardSection from "@/components/spec-board/SpecBoardSection";

export const metadata = {
  title: "Onboarding, States & Responsive",
  description:
    "First-run onboarding, settings, product states, accessibility and responsive behavior.",
};

type OnboardCard = {
  step: string;
  title: string;
  body: string;
  action: string;
  bullets?: string[];
  choices?: [string, string][];
  back?: boolean;
  link?: string;
  dots?: boolean;
};

const onboarding: OnboardCard[] = [
  {
    step: "1",
    title: "Welcome to Verto",
    body: "Your local-first MDX knowledge workspace.",
    action: "Get Started",
    bullets: [
      "Local & private by default",
      "Powerful authoring & linking",
      "Connect when you are ready",
    ],
    dots: true,
  },
  {
    step: "2",
    title: "Where are your docs?",
    body: "Choose a source to get started.",
    action: "Next",
    back: true,
    choices: [
      ["Local Folder", "Scan a folder on this device"],
      ["Git Repository", "Clone or connect a repo."],
      ["Verto Cloud (Beta)", "Private sync & backup"],
    ],
  },
  {
    step: "3",
    title: "Connect an AI provider",
    body: "Optional — enable AI features like summaries and Q&A.",
    action: "Next",
    back: true,
    choices: [
      ["OpenAI", "Add API key…"],
      ["Anthropic", "Add API key…"],
      ["Ollama (Local)", "http://localhost:11434"],
    ],
  },
  {
    step: "4",
    title: "You are all set!",
    body: "Let’s open a document to get acquainted.",
    action: "Open Introduction",
    link: "Open Library",
    choices: [
      ["Introduction.mdx", ""],
      ["Getting Started.mdx", ""],
      ["Project Overview.mdx", ""],
    ],
  },
];

type SRow =
  | { t: "select"; k: string; v: string }
  | { t: "toggle"; k: string; on: boolean }
  | { t: "action"; k: string; v?: string; b: string }
  | { t: "segment"; k: string; opts: string[]; on: string }
  | { t: "swatch"; k: string }
  | { t: "slider"; k: string; v: string }
  | { t: "note"; k: string; v: string; ok?: boolean };

type SCard = { title: string; icon: LucideIcon; rows?: SRow[]; about?: boolean };

const ACCENTS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

const settingsCards: SCard[] = [
  {
    title: "General",
    icon: Settings2,
    rows: [
      { t: "toggle", k: "Open previous workspace", on: false },
      { t: "action", k: "Default Library", v: "~/Docs", b: "Change…" },
      { t: "toggle", k: "Check for updates", on: true },
    ],
  },
  {
    title: "Appearance",
    icon: Palette,
    rows: [
      { t: "segment", k: "Theme", opts: ["Light", "Dark", "System"], on: "System" },
      { t: "swatch", k: "Accent Color" },
      { t: "select", k: "Density", v: "Comfortable" },
      { t: "select", k: "Font Size", v: "14px" },
    ],
  },
  {
    title: "Editor",
    icon: Code2,
    rows: [
      { t: "select", k: "Default Mode", v: "WYSIWYG" },
      { t: "select", k: "Line Wrap", v: "On" },
      { t: "toggle", k: "Show Line Numbers", on: true },
      { t: "toggle", k: "Auto Save", on: true },
      { t: "toggle", k: "Format on Save", on: true },
    ],
  },
  {
    title: "Reading",
    icon: FileText,
    rows: [
      { t: "select", k: "Default View", v: "Split" },
      { t: "select", k: "Font", v: "Inter" },
      { t: "select", k: "Font Size", v: "16px" },
      { t: "select", k: "Heading Style", v: "Atx (#)" },
      { t: "toggle", k: "Show Reading Progress", on: true },
    ],
  },
  {
    title: "Agent",
    icon: Bot,
    rows: [
      { t: "select", k: "Provider", v: "OpenAI" },
      { t: "select", k: "Model", v: "gpt-4.1-mini" },
      { t: "action", k: "API Key", v: "••••••", b: "Test" },
      { t: "slider", k: "Temperature", v: "0.2" },
    ],
  },
  {
    title: "Privacy",
    icon: Lock,
    rows: [
      { t: "toggle", k: "Telemetry", on: false },
      { t: "toggle", k: "Crash Reports", on: true },
      { t: "action", k: "Local Data", b: "Clear cache…" },
      { t: "action", k: "Data Directory", b: "Open" },
    ],
  },
  {
    title: "Keyboard Shortcuts",
    icon: Keyboard,
    rows: [
      { t: "select", k: "Preset", v: "Verto (Default)" },
      { t: "toggle", k: "Show Shortcut Hints", on: true },
      { t: "action", k: "Open Shortcuts", b: "Cheatsheet…" },
      { t: "note", k: "Conflicts", v: "None detected", ok: true },
    ],
  },
  { title: "About", icon: Settings2, about: true },
];

type Tone = "ok" | "warn" | "error" | "muted";

type StateDef = {
  n: number;
  title: string;
  icon: LucideIcon;
  tone: Tone;
  msg?: string;
  detail: string;
  badge?: string;
  buttons?: string[];
  box?: "skeleton" | "code" | "warn" | "conflict";
  code?: string;
};

const productStates: StateDef[] = [
  {
    n: 1,
    title: "Empty Library",
    icon: FileText,
    tone: "muted",
    msg: "No documents yet.",
    detail: "Create or import your first document.",
    buttons: ["New Document"],
  },
  {
    n: 2,
    title: "No Source Connected",
    icon: Database,
    tone: "muted",
    msg: "No source connected.",
    detail: "Connect a folder, repository or cloud source.",
    buttons: ["Connect Source"],
  },
  {
    n: 3,
    title: "Loading Skeleton",
    icon: RefreshCw,
    tone: "muted",
    detail: "Content is loading in the background.",
    box: "skeleton",
  },
  {
    n: 4,
    title: "Offline Mode",
    icon: WifiOff,
    tone: "warn",
    msg: "Work offline.",
    detail: "Changes are saved locally and sync when you’re back.",
    badge: "Offline",
    buttons: ["Retry"],
  },
  {
    n: 5,
    title: "Syncing",
    icon: RefreshCw,
    tone: "ok",
    detail: "Sync in progress.",
    badge: "Syncing…",
    box: "skeleton",
  },
  {
    n: 6,
    title: "Sync Failed",
    icon: AlertTriangle,
    tone: "error",
    msg: "Sync failed.",
    detail: "Check your connection and try again.",
    badge: "Sync Failed",
    buttons: ["Retry", "View Details"],
  },
  {
    n: 7,
    title: "No AI Key Connected",
    icon: Bot,
    tone: "error",
    msg: "AI not connected.",
    detail: "Connect a provider to enable summaries and Q&A.",
    buttons: ["Connect AI"],
  },
  {
    n: 8,
    title: "No Search Results",
    icon: Search,
    tone: "muted",
    msg: "No results found.",
    detail: "Try different keywords or check spelling.",
    buttons: ["Clear Search"],
  },
  {
    n: 9,
    title: "Unknown MDX Component",
    icon: Code2,
    tone: "error",
    detail: "Reader encountered an unknown component.",
    box: "code",
    code: '<UnknownComponent prop="value" />',
  },
  {
    n: 10,
    title: "Large File Warning",
    icon: AlertTriangle,
    tone: "warn",
    detail: "This file is 18.4 MB and may impact performance.",
    box: "warn",
    buttons: ["Continue", "Cancel"],
  },
  {
    n: 11,
    title: "Merge Conflict",
    icon: GitBranch,
    tone: "error",
    detail: "Version conflict detected.",
    box: "conflict",
    buttons: ["Resolve", "Open in Editor"],
  },
  {
    n: 12,
    title: "Permission Denied",
    icon: Lock,
    tone: "error",
    msg: "Permission denied.",
    detail: "You do not have access to this document.",
    buttons: ["Request Access"],
  },
  {
    n: 13,
    title: "Archived / Read-Only",
    icon: FileText,
    tone: "warn",
    msg: "Old Decision.mdx",
    detail: "Archived content is read-only.",
    badge: "Archived",
    buttons: ["Duplicate"],
  },
  {
    n: 14,
    title: "Trash State",
    icon: Trash2,
    tone: "muted",
    msg: "Deleted items.",
    detail: "This item is in the trash.",
    badge: "In Trash",
    buttons: ["Restore"],
  },
];

const shortcuts: [string, string][] = [
  ["Command Palette", "⌘ K"],
  ["New Document", "⌘ N"],
  ["Open", "⌘ O"],
  ["Save", "⌘ S"],
  ["Search", "⌘ F"],
  ["Global Search", "⇧ ⌘ F"],
  ["Toggle Sidebar", "⌘ \\"],
  ["Toggle Right Rail", "⌥ ⌘ R"],
  ["Toggle Split View", "⌘ J"],
  ["Preview (Toggle)", "⌘ P"],
  ["Focus Editor", "⌘ E"],
  ["Table of Contents", "⌘ T"],
  ["Find in Document", "⌘ F"],
  ["Replace", "⇧ ⌘ H"],
  ["Go to Definition", "⌘ D"],
  ["Back", "⌘ ["],
  ["Forward", "⌘ ]"],
  ["Help", "⌘ /"],
];

const commandGroups: { label: string; items: [string, string][] }[] = [
  {
    label: "Actions",
    items: [
      ["New Document", "⌘ N"],
      ["Import", "⌘ I"],
      ["Export Library", "⇧ ⌘ E"],
      ["Settings", "⌘ ,"],
      ["Toggle Split View", "⌘ J"],
    ],
  },
  {
    label: "Go to",
    items: [
      ["Go to File", "⌘ P"],
      ["Go to Heading", "⌘ G"],
      ["Go to Backlink", "⌘ B"],
    ],
  },
];

const commandRecent = ["Project Overview.mdx", "API Reference.mdx", "Decisions/ADR-001.mdx"];

const responsive = [
  ["Desktop Wide", ">= 1440px", "Full rail, right context rail visible, split view maintained."],
  ["Laptop", "1024px - 1439px", "Left rail collapses to icons; right rail can slide out."],
  ["Tablet", "768px - 1023px", "Only icon rail remains; drawers open over content."],
  ["Narrow / Mobile", "< 767px", "Single column content; editor/preview toggle in header."],
];

function MiniSwitch({ on = false }: { on?: boolean }) {
  return (
    <span className={`uhd07-switch${on ? " is-on" : ""}`} aria-hidden>
      <span />
    </span>
  );
}

function SettingRow({ row }: { row: SRow }) {
  const label = <span>{row.k}</span>;
  switch (row.t) {
    case "toggle":
      return (
        <p>
          {label}
          <MiniSwitch on={row.on} />
        </p>
      );
    case "select":
      return (
        <p>
          {label}
          <span className="uhd07-ctl">
            <em>{row.v}</em>
            <ChevronDown aria-hidden />
          </span>
        </p>
      );
    case "action":
      return (
        <p>
          {label}
          <span className="uhd07-ctl">
            {row.v ? <em>{row.v}</em> : null}
            <button type="button" className="uhd07-mini-btn">
              {row.b}
            </button>
          </span>
        </p>
      );
    case "segment":
      return (
        <p>
          {label}
          <span className="uhd07-seg">
            {row.opts.map((opt) => (
              <b key={opt} className={opt === row.on ? "is-on" : ""}>
                {opt}
              </b>
            ))}
          </span>
        </p>
      );
    case "swatch":
      return (
        <p>
          {label}
          <span className="uhd07-swatches">
            {ACCENTS.map((color, index) => (
              <i key={color} style={{ background: color }} className={index === 5 ? "is-on" : ""} />
            ))}
          </span>
        </p>
      );
    case "slider":
      return (
        <p>
          {label}
          <span className="uhd07-ctl">
            <span className="uhd07-slider">
              <i />
            </span>
            <em>{row.v}</em>
          </span>
        </p>
      );
    case "note":
      return (
        <p>
          {label}
          <span className="uhd07-ctl">
            <em>{row.v}</em>
            {row.ok ? <Check aria-hidden /> : null}
          </span>
        </p>
      );
    default:
      return null;
  }
}

function SettingCard({ card }: { card: SCard }) {
  const Icon = card.icon;
  return (
    <article className="uhd07-setting-card">
      <header>
        <Icon aria-hidden />
        <strong>{card.title}</strong>
      </header>
      {card.about ? (
        <div className="uhd07-about">
          <span className="uhd07-about-logo">V</span>
          <strong>Verto</strong>
          <small>Version 1.0.0</small>
          <small>Local-First. Yours.</small>
          <small>© 2025 Verto Labs Inc.</small>
          <div className="uhd07-about-actions">
            <button type="button">Release Notes</button>
            <button type="button">License</button>
          </div>
        </div>
      ) : (
        card.rows?.map((row) => <SettingRow key={row.k} row={row} />)
      )}
    </article>
  );
}

function StateCard({ state }: { state: StateDef }) {
  const Icon = state.icon;
  const titleTop = state.box === "code" || state.box === "conflict";
  return (
    <article className={`tone-${state.tone}`}>
      <span className="uhd07-step">{state.n}</span>
      {state.badge ? (
        <span className={`uhd07-state-badge tone-${state.tone}`}>{state.badge}</span>
      ) : null}

      {state.box === "skeleton" ? (
        <div className="uhd07-state-skel" aria-hidden>
          <i />
          <i />
          <i />
        </div>
      ) : null}
      {titleTop ? <strong className="uhd07-state-title">{state.title}</strong> : null}
      {state.box === "code" ? <code className="uhd07-state-codebox">{state.code}</code> : null}
      {state.box === "conflict" ? (
        <div className="uhd07-state-conflict" aria-hidden>
          <span>{"<<<<<<< HEAD"}</span>
          <span>Your changes</span>
          <span>{"======="}</span>
          <span>Incoming changes</span>
          <span>{">>>>>>> main"}</span>
        </div>
      ) : null}
      {state.box === "warn" ? (
        <div className="uhd07-state-warnbox">
          <Icon aria-hidden />
          <strong>{state.title}</strong>
          <small>{state.detail}</small>
        </div>
      ) : null}
      {!state.box ? (
        <>
          <Icon aria-hidden />
          <strong>{state.title}</strong>
        </>
      ) : null}

      {state.box !== "warn" && state.msg ? <p>{state.msg}</p> : null}
      {state.box !== "warn" ? <small>{state.detail}</small> : null}
      {state.buttons?.length ? (
        <div className="uhd07-state-btns">
          {state.buttons.map((btn, index) => (
            <button type="button" key={btn} className={index === 0 ? "is-primary" : ""}>
              {btn}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function DeviceFrame({
  size,
  label,
}: {
  size: "desktop" | "laptop" | "tablet" | "mobile";
  label: string;
}) {
  return (
    <div className={`uhd07-device is-${size}`}>
      <header>
        <span>Verto</span>
        <em>{label}</em>
        <MoreDots />
      </header>
      <div>
        <aside />
        <main>
          <strong>Untitled Knowledge Base</strong>
          <p />
          <p />
          <p />
        </main>
        <aside />
      </div>
    </div>
  );
}

function MoreDots() {
  return (
    <span className="uhd07-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export default function SettingsPage() {
  return (
    <SpecBoardPageShell
      className="uhd07-page"
      ariaLabel="Onboarding, states and responsive behavior"
      main={
        <>
          <SpecBoardHeader
            className="uhd07-board-head"
            brand={
              <div className="uhd07-brand">
                <strong>V</strong>
                <span>Verto</span>
              </div>
            }
            title="07 - Onboarding, States & Responsive Behavior"
            description="First-run experience, key shell settings, system states across modules, responsive rules and accessibility."
          >
            <span className="uhd07-spec">Verto Product Design Specification / Page 07</span>
          </SpecBoardHeader>

          <main className="uhd07-grid">
            <SpecBoardSection
              className="uhd07-panel uhd07-onboarding"
              headerClassName="uhd07-section-head"
              title="Onboarding Flow (First Run)"
            >
              <div className="uhd07-onboarding-grid">
                {onboarding.map((card) => (
                  <article key={card.step} className="uhd07-onboarding-card">
                    <span className="uhd07-step">{card.step}</span>
                    <h2>{card.title}</h2>
                    <p>{card.body}</p>
                    <div className="uhd07-choice-list">
                      {card.bullets
                        ? card.bullets.map((item, index) => (
                            <span key={item} className={index === 0 ? "is-selected" : ""}>
                              {index === 0 ? <Check aria-hidden /> : <span aria-hidden />}
                              {item}
                            </span>
                          ))
                        : (card.choices ?? []).map(([choice, sub], index) => (
                            <span key={choice} className={index === 0 ? "is-selected" : ""}>
                              {index === 0 ? <Check aria-hidden /> : <span aria-hidden />}
                              <span className="uhd07-choice-main">
                                <b>{choice}</b>
                                {sub ? <em>{sub}</em> : null}
                              </span>
                            </span>
                          ))}
                    </div>
                    <div className="uhd07-onboard-actions">
                      {card.back ? (
                        <button type="button" className="is-ghost">
                          Back
                        </button>
                      ) : null}
                      <button type="button">{card.action}</button>
                    </div>
                    {card.link ? <span className="uhd07-onboard-link">{card.link}</span> : null}
                    {card.dots ? (
                      <div className="uhd07-onboard-dots" aria-hidden>
                        <i className="is-on" />
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-settings"
              headerClassName="uhd07-section-head"
              title="Key Settings Pages"
            >
              <div className="uhd07-settings-grid">
                <aside>
                  {[
                    "General",
                    "Appearance",
                    "Editor",
                    "Reading",
                    "Agent",
                    "Privacy",
                    "Keyboard Shortcuts",
                    "About",
                  ].map((item) => (
                    <span key={item} className={item === "Appearance" ? "is-active" : ""}>
                      {item}
                    </span>
                  ))}
                </aside>
                <div>
                  {settingsCards.map((card) => (
                    <SettingCard key={card.title} card={card} />
                  ))}
                </div>
              </div>
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-shortcuts"
              headerClassName="uhd07-section-head"
              title="Shortcut Reference"
            >
              <p className="uhd07-col-head">
                <span>Action</span>
                <kbd>Shortcut</kbd>
              </p>
              {shortcuts.map(([action, shortcut]) => (
                <p key={action}>
                  <span>{action}</span>
                  <kbd>{shortcut}</kbd>
                </p>
              ))}
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-command"
              headerClassName="uhd07-section-head"
              title="Command Palette"
            >
              <SpecBoardSearchPrompt label="Type a command…" />
              {commandGroups.map((group) => (
                <div key={group.label} className="uhd07-cmd-block">
                  <span className="uhd07-cmd-group">{group.label}</span>
                  {group.items.map(([action, shortcut]) => (
                    <p key={action}>
                      <span>{action}</span>
                      <kbd>{shortcut}</kbd>
                    </p>
                  ))}
                </div>
              ))}
              <div className="uhd07-cmd-block">
                <span className="uhd07-cmd-group">Recent</span>
                {commandRecent.map((file) => (
                  <p key={file} className="uhd07-cmd-recent">
                    <span>
                      <FileText aria-hidden />
                      {file}
                    </span>
                  </p>
                ))}
              </div>
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-states"
              headerClassName="uhd07-section-head"
              title="Product States Across Modules"
            >
              <div className="uhd07-state-grid">
                {productStates.map((state) => (
                  <StateCard key={state.title} state={state} />
                ))}
              </div>
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-accessibility"
              headerClassName="uhd07-section-head"
              title="Accessibility Notes"
            >
              <div className="uhd07-focus-row">
                <button type="button">Primary Button</button>
                <label>Focused input</label>
                <span>Focused item</span>
              </div>
              <div className="uhd07-contrast">
                {[
                  ["Text BG", "15.8:1", "#000"],
                  ["AA", "7.2:1", "#444"],
                  ["AA", "4.6:1", "#777"],
                  ["AA", "12.1:1", "#111"],
                  ["AA", "4.7:1", "#ddd"],
                ].map(([label, ratio, color]) => (
                  <article key={`${label}-${ratio}`}>
                    <span style={{ background: color }} />
                    <strong>{label}</strong>
                    <small>{ratio}</small>
                  </article>
                ))}
              </div>
              <div className="uhd07-a11y-grid">
                <article>
                  <Keyboard aria-hidden />
                  <div>
                    <strong>Keyboard Navigation</strong>
                    <p>Use Tab/Shift+Tab to move focus across visible controls.</p>
                  </div>
                </article>
                <article>
                  <RefreshCw aria-hidden />
                  <div>
                    <strong>Reduced Motion</strong>
                    <p>Respects reduced-motion preferences and disables non-essential animation.</p>
                  </div>
                  <MiniSwitch />
                </article>
                <article>
                  <Monitor aria-hidden />
                  <div>
                    <strong>Screen Reader</strong>
                    <p>Semantic landmarks, labels, alt text and status updates.</p>
                  </div>
                </article>
              </div>
            </SpecBoardSection>

            <SpecBoardSection
              className="uhd07-panel uhd07-responsive"
              headerClassName="uhd07-section-head"
              title="Responsive Behavior"
            >
              <div className="uhd07-responsive-grid">
                {responsive.map(([title, size, body], index) => (
                  <article key={title}>
                    <span className="uhd07-step">{index + 1}</span>
                    <DeviceFrame
                      size={
                        index === 0
                          ? "desktop"
                          : index === 1
                            ? "laptop"
                            : index === 2
                              ? "tablet"
                              : "mobile"
                      }
                      label={size}
                    />
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <aside className="uhd07-breakpoints">
                <strong>Breakpoints</strong>
                {responsive.map(([, size], index) => (
                  <p key={size}>
                    <span>{index + 1}</span>
                    {size}
                  </p>
                ))}
              </aside>
              <aside className="uhd07-behavior-notes">
                <strong>Behavior Notes</strong>
                <p>Layout gracefully adapts without horizontal scroll.</p>
                <p>Persistent shell actions remain reachable.</p>
                <p>Drawers trap focus when open and close with Esc.</p>
                <p>Resize observers preserve user preferences.</p>
              </aside>
            </SpecBoardSection>
          </main>
        </>
      }
      footer={
        <footer className="uhd07-footer">
          <span>Verto Design System v1.0</span>
          <span>Last updated: May 12, 2025</span>
          <span>Built for local-first knowledge work.</span>
          <span>
            <Sun aria-hidden /> Light
          </span>
          <span>
            <Moon aria-hidden /> Dark
          </span>
          <span>Back to index</span>
        </footer>
      }
    />
  );
}
