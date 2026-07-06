import {
  AlertTriangle,
  Activity,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  FileText,
  FolderOpen,
  Github,
  GitBranch,
  HardDrive,
  Home,
  Inbox,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SquareTerminal,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import SpecBoardHeader from "@/components/spec-board/SpecBoardHeader";
import SpecBoardPageShell from "@/components/spec-board/SpecBoardPageShell";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";
import SpecBoardSection from "@/components/spec-board/SpecBoardSection";
import type { ConnectionDetails } from "@/lib/connection-info";

interface SourcesWorkflowViewProps {
  connection: ConnectionDetails;
}

interface SourceRow {
  name: string;
  path: string;
  type: string;
  status: "synced" | "syncing" | "pending" | "paused" | "error";
  lastSync: string;
  items: string;
}

const sourceRows: SourceRow[] = [
  {
    name: "Verto Docs (Local)",
    path: "/Users/alan/verto",
    type: "Local",
    status: "synced",
    lastSync: "2m ago",
    items: "1,248",
  },
  {
    name: "Verto (GitHub)",
    path: "github.com/alan/verto",
    type: "Git",
    status: "synced",
    lastSync: "3m ago",
    items: "632",
  },
  {
    name: "Personal Notes (OneDrive)",
    path: "OneDrive/Notes",
    type: "Cloud",
    status: "syncing",
    lastSync: "60%",
    items: "1,102",
  },
  {
    name: "Reading List (RSS)",
    path: "12 feeds",
    type: "Web",
    status: "synced",
    lastSync: "5m ago",
    items: "256",
  },
  {
    name: "Blog Collection",
    path: "blog.verto.app",
    type: "Web",
    status: "synced",
    lastSync: "1h ago",
    items: "184",
  },
  {
    name: "Book Highlights",
    path: "Import (EPUB)",
    type: "Import",
    status: "synced",
    lastSync: "Yesterday",
    items: "312",
  },
  {
    name: "Research Papers",
    path: "/Users/alan/papers",
    type: "Local",
    status: "pending",
    lastSync: "—",
    items: "98",
  },
  {
    name: "Work (GitLab)",
    path: "gitlab.com/acme/verto",
    type: "Git",
    status: "error",
    lastSync: "2h ago",
    items: "—",
  },
  {
    name: "Archive",
    path: "/Volumes/Archive",
    type: "Local",
    status: "paused",
    lastSync: "—",
    items: "3,210",
  },
];

const gitFiles = [
  ["docs/agent/workflow.mdx", "M", "verto"],
  ["docs/getting-started.mdx", "M", "verto"],
  ["components/Callout.tsx", "M", "verto"],
  ["assets/diagram.svg", "A", "verto"],
  ["README.md", "M", "verto"],
  ["docs/old-guide.mdx", "D", "verto"],
  ["articles/ai-native.md", "M", "acme/docs"],
  ["guides/cli.md", "A", "acme/docs"],
  ["notes/meeting-2024-05-12.md", "M", "personal/notes"],
  ["ideas.md", "M", "personal/notes"],
];

const repoRows: [string, string, number, number, number][] = [
  ["verto", "main", 18, 6, 2],
  ["acme/docs", "main", 4, 1, 0],
  ["personal/notes", "main", 2, 0, 0],
];

const branchRows: [string, string, string, string][] = [
  ["main", "docs: improve agent workflow section", "2m ago", "Alan Chen"],
  ["develop", "feat(agent): add tool call inspector", "1h ago", "Alan Chen"],
  ["feature/agent-ui", "refactor: simplify context builder", "3h ago", "Alan Chen"],
  ["docs/update-readme", "docs: provide getting started", "Yesterday", "Sarah Lee"],
  ["fix/link-parser", "fix(parser): handle array bug", "2 days ago", "Alan Chen"],
  ["stale/old-experiment", "chore: update deps", "2 days ago", "Alan Chen"],
];

const syncActivity: [string, string, string, string, "syncing" | "ok" | "pending" | "error"][] = [
  ["Personal Notes (OneDrive)", "Indexed 662 / 1,102 items", "60%", "4m ago", "syncing"],
  ["Verto (GitHub)", "Everything up to date", "100%", "3m ago", "ok"],
  ["Verto Docs (Local)", "Indexed 24 files", "100%", "2m ago", "ok"],
  ["Research Papers (Local)", "Sync pending", "0%", "10m ago", "pending"],
  ["Work (GitLab)", "Sync failed", "0%", "2h ago", "error"],
];

const sourceHealth: [string, number, string][] = [
  ["Healthy", 6, "#16a34a"],
  ["Syncing", 2, "#2563eb"],
  ["Paused", 1, "#6b7280"],
  ["Error", 1, "#dc2626"],
];

const emptyStates: [string, string, string, LucideIcon][] = [
  ["No Sources Yet", "Add a source to start building your knowledge.", "Add Source", FolderOpen],
  ["No Changes", "Your repositories are up to date.", "Refresh", CheckCircle2],
  ["No Results", "Try adjusting your filters or search.", "Clear filters", Search],
  ["Sync Paused", "This source is paused. Resume to continue syncing.", "Resume", RefreshCw],
  ["Sync Error", "Something went wrong. Check the logs for details.", "View logs", AlertTriangle],
];

const toastRows = [
  ["ok", "Source added successfully.", "Undo"],
  ["ok", "Changes committed and pushed.", "Open"],
  ["ok", "Sync completed.", "View"],
  ["error", "Sync failed. Click to retry.", "Retry"],
  ["ok", "Successfully disconnected.", "Undo"],
];

const sourceCategories: [LucideIcon, string, string][] = [
  [HardDrive, "Local", "Files on your device"],
  [Github, "Git", "GitHub, GitLab, Gitea..."],
  [Cloud, "Cloud", "OneDrive, Google Drive..."],
  [BookOpen, "Web", "RSS, websites, Notion..."],
  [FolderOpen, "Import", "MDX, Markdown, HTML, EPUB..."],
];

const sourceStatuses = [
  ["Synced", "Up to date", "synced"],
  ["Syncing", "Changes are being synced", "syncing"],
  ["Pending", "Waiting to be synced", "pending"],
  ["Error", "Sync failed", "error"],
  ["Paused", "Sync is paused", "paused"],
];

const gitBadges = [
  ["Untracked", "U"],
  ["Modified", "M"],
  ["Deleted", "D"],
  ["Renamed", "R"],
  ["Conflict", "C"],
  ["Staged", "A"],
];

const productNav: [LucideIcon, string, string?][] = [
  [Home, "Home"],
  [Inbox, "Inbox", "8"],
  [BookOpen, "Library"],
  [FolderOpen, "Collections"],
  [FileText, "Tags"],
  [Bookmark, "Bookmarks"],
  [GitBranch, "Graph"],
  [SquareTerminal, "Agent"],
  [CheckCircle2, "Knowledge Studio"],
  [Activity, "Activity"],
];

function StatusPill({ status }: { status: SourceRow["status"] }) {
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <span className={`uhd06-status is-${status}`}>
      <span aria-hidden />
      {label}
    </span>
  );
}

function Panel({
  index,
  title,
  children,
  className = "",
}: {
  index: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`uhd06-panel ${className}`} aria-label={title}>
      <header className="uhd06-panel-head">
        <span>{index}</span>
        <div>
          <h2>{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function SourceRail() {
  return (
    <aside className="uhd06-source-rail" aria-label="Source system reference">
      <div className="uhd06-rail-brand">
        <strong>V</strong>
        <span>verto</span>
      </div>
      <p className="uhd06-rail-intro">
        All-in-one MDX workspace for reading, writing and thinking with AI agents.
      </p>

      <section className="uhd06-rail-block">
        <h2>Source Categories</h2>
        {sourceCategories.map(([Icon, label, note]) => (
          <article key={label} className="uhd06-rail-item">
            <Icon aria-hidden />
            <div>
              <strong>{label}</strong>
              <span>{note}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="uhd06-rail-block">
        <h2>Source Status</h2>
        {sourceStatuses.map(([label, note, tone]) => (
          <article key={label} className={`uhd06-rail-status is-${tone}`}>
            <span aria-hidden />
            <div>
              <strong>{label}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="uhd06-rail-block">
        <h2>Git Status Badge</h2>
        {gitBadges.map(([label, code]) => (
          <article key={label} className="uhd06-rail-badge">
            <span>{code}</span>
            <strong>{label}</strong>
          </article>
        ))}
      </section>

      <section className="uhd06-rail-block">
        <h2>Panel Layout</h2>
        <div className="uhd06-layout-chips">
          <span>Left Rail 240px</span>
          <span>Content fluid</span>
          <span>Right Rail 340px</span>
        </div>
      </section>

      <section className="uhd06-rail-block">
        <h2>Keyboard Shortcuts</h2>
        {[
          ["K", "Add Source"],
          ["R", "Resync Source"],
          ["G", "Open Git Changes"],
          ["P", "Push Changes"],
          ["F", "Fetch Changes"],
        ].map(([key, label]) => (
          <article key={key} className="uhd06-shortcut">
            <kbd>{key}</kbd>
            <span>{label}</span>
          </article>
        ))}
      </section>
    </aside>
  );
}

function ProductNav() {
  return (
    <aside className="uhd06-product-nav" aria-label="Verto workspace navigation">
      <div className="uhd06-product-brand">
        <strong>V</strong>
        <span>verto</span>
      </div>
      <SpecBoardSearchPrompt
        className="uhd06-product-search"
        label="Search anything..."
        shortcut="⌘K"
      />
      <nav>
        {productNav.map(([Icon, label, badge], index) => (
          <a key={label} className={index === 0 ? "is-active" : undefined}>
            <Icon aria-hidden />
            <span>{label}</span>
            {badge ? <em>{badge}</em> : null}
          </a>
        ))}
      </nav>
      <a className="uhd06-product-settings">
        <Settings2 aria-hidden />
        Settings
      </a>
    </aside>
  );
}

function SourcesOverview({ connection }: { connection: ConnectionDetails }) {
  const activePath = connection.path && connection.path !== "/" ? connection.path : "/docs";
  return (
    <Panel index="1" title="Sources Overview" className="uhd06-sources-overview">
      <div className="uhd06-section-title">
        <div>
          <strong>Sources</strong>
          <span>{sourceRows.length} sources · 2 syncing · All up to date</span>
        </div>
        <button type="button">
          <Plus aria-hidden /> Add Source
        </button>
      </div>
      <div className="uhd06-source-table">
        <div className="uhd06-source-head">
          <span>Source</span>
          <span>Type</span>
          <span>Status</span>
          <span>Last Sync</span>
          <span>Items</span>
        </div>
        {sourceRows.map((source, index) => (
          <div key={source.name} className="uhd06-source-row">
            <span>
              <strong>{index === 0 ? connection.name || source.name : source.name}</strong>
              <small>{index === 0 ? activePath : source.path}</small>
            </span>
            <em>{index === 0 ? connection.kind : source.type}</em>
            <StatusPill status={source.status} />
            <em>{source.lastSync}</em>
            <em>{source.items}</em>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AddSourceFlow() {
  const cards: [LucideIcon, string, string, string][] = [
    [Github, "GitHub", "Sync repositories from GitHub or Vercel.", "Connect GitHub"],
    [FolderOpen, "Local Folder", "Index Markdown, MDX, and local files.", "Choose folder"],
    [Cloud, "OneDrive", "Connect your OneDrive account.", "Connect OneDrive"],
    [BookOpen, "Web / RSS", "Add websites, RSS feeds, or channels.", "Add web source"],
    [FileText, "Import Files", "Import MDX, Markdown, HTML, EPUB, and more.", "Import files"],
    [SquareTerminal, "Notion", "Import pages from your Notion workspace.", "Connect Notion"],
  ];

  return (
    <Panel index="2" title="Add Source Flow" className="uhd06-add-flow">
      <div className="uhd06-stepper" aria-label="Add source progress">
        {["Choose Type", "Connect", "Configure", "Sync", "Done"].map((label, index) => (
          <div key={label} className={index === 0 ? "is-active" : ""}>
            <span>{index + 1}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="uhd06-source-cards">
        {cards.map(([Icon, title, body, action]) => (
          <article key={title}>
            <Icon aria-hidden />
            <div>
              <strong>
                {title}
                {title === "Notion" ? <span className="uhd06-beta">beta</span> : null}
              </strong>
              <p>{body}</p>
              <button type="button">{action}</button>
            </div>
          </article>
        ))}
      </div>
      <div className="uhd06-progress-card">
        <div>
          <strong>Sync Progress</strong>
          <span>Personal Notes · OneDrive</span>
        </div>
        <div className="uhd06-progress-status">
          <span>Scanning files and indexing content…</span>
          <em>60%</em>
        </div>
        <div className="uhd06-progress-bar">
          <span style={{ width: "60%" }} />
        </div>
        <small>Indexed 662 / 1,102 items · 4m 12s remaining</small>
        <button type="button">Pause</button>
      </div>
    </Panel>
  );
}

function GitChanges() {
  return (
    <Panel index="3" title="Git Changes (All)" className="uhd06-git-changes">
      <div className="uhd06-toolbar">
        <div>
          <button type="button" className="is-active">
            Changes <span>32</span>
          </button>
          <button type="button">History</button>
          <button type="button">Branches</button>
        </div>
        <div>
          <button type="button">Pull</button>
          <button type="button">Fetch</button>
          <button type="button">
            <MoreHorizontal aria-hidden />
          </button>
        </div>
      </div>
      <div className="uhd06-git-shell">
        <aside>
          {repoRows.map(([repo, branch, m, a, d]) => (
            <article key={repo} className={repo === "verto" ? "is-active" : ""}>
              <div className="uhd06-repo-top">
                <strong>{repo}</strong>
                <span>({branch})</span>
                {repo === "verto" ? <ChevronDown aria-hidden /> : null}
              </div>
              <div className="uhd06-repo-badges">
                {m > 0 ? <b className="tone-m">M {m}</b> : null}
                {a > 0 ? <b className="tone-a">A {a}</b> : null}
                {d > 0 ? <b className="tone-d">D {d}</b> : null}
              </div>
            </article>
          ))}
          <button type="button">+ Add Repository</button>
        </aside>
        <div className="uhd06-git-list">
          <div className="uhd06-git-head">
            <span>File</span>
            <span>Status</span>
            <span>Repository</span>
          </div>
          {gitFiles.map(([file, status, repo]) => (
            <div key={file} className="uhd06-git-row">
              <FileText aria-hidden />
              <span>{file}</span>
              <strong className={`tone-${status.toLowerCase()}`}>{status}</strong>
              <em>{repo}</em>
            </div>
          ))}
        </div>
      </div>
      <footer className="uhd06-actions">
        <span>32 changes</span>
        <button type="button">Stage all</button>
        <button type="button" className="is-dark">
          Commit
        </button>
      </footer>
    </Panel>
  );
}

function FileDiff() {
  const baseLines: [number, string, string][] = [
    [1, "## Agent Workflow", ""],
    [2, "", ""],
    [3, "The agent follows a clear", ""],
    [4, "workflow to help you.", ""],
    [5, "", ""],
    [6, "1. Capture context", "del"],
    [7, "2. Understand deeply", "del"],
    [8, "3. Propose actions", "del"],
  ];
  const workLines: [number, string, string][] = [
    [1, "## Agent Workflow", ""],
    [2, "", ""],
    [3, "The agent follows a clear", ""],
    [4, "workflow to help you.", ""],
    [5, "", ""],
    [6, "1. Capture context", ""],
    [7, "2. Understand deeply", ""],
    [8, "3. Propose actions", ""],
    [9, "4. Get your approval", "add"],
    [10, "5. Apply changes safely", "add"],
  ];
  return (
    <Panel index="4" title="File Diff (Side by Side)" className="uhd06-diff">
      <div className="uhd06-file-path">
        <FileText aria-hidden />
        docs/agent/workflow.mdx · verto (main)
        <span>
          <button type="button" className="is-active">
            Side by side
          </button>
          <button type="button">Unified</button>
        </span>
      </div>
      <div className="uhd06-code-diff">
        <div className="uhd06-diff-col">
          <header>main (base)</header>
          <div className="uhd06-diff-body">
            {baseLines.map(([n, text, tone]) => (
              <div key={n} className={`uhd06-diff-line${tone ? ` is-${tone}` : ""}`}>
                <span className="uhd06-diff-ln">{n}</span>
                <code>{text || "\u00a0"}</code>
              </div>
            ))}
          </div>
        </div>
        <div className="uhd06-diff-col">
          <header>Working Directory</header>
          <div className="uhd06-diff-body">
            {workLines.map(([n, text, tone]) => (
              <div key={n} className={`uhd06-diff-line${tone ? ` is-${tone}` : ""}`}>
                <span className="uhd06-diff-ln">{n}</span>
                <code>{text || "\u00a0"}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CommitChanges() {
  return (
    <Panel index="5" title="Commit Changes" className="uhd06-commit">
      <p className="uhd06-commit-target">
        Commit to <strong>verto (main)</strong>
      </p>
      <div className="uhd06-form">
        <label>
          Summary (required)
          <input defaultValue="docs: improve agent workflow section" />
        </label>
        <label>
          Description (optional)
          <textarea defaultValue={"- Add approval step\n- Clarify safe apply"} />
        </label>
        <p className="uhd06-commit-related">Related to #128</p>
      </div>
      <div className="uhd06-commit-meta">
        <span>18 modified</span>
        <span>6 added</span>
        <span>2 deleted</span>
      </div>
      <label className="uhd06-check-row">
        <input type="checkbox" defaultChecked /> Push changes to origin
      </label>
      <footer className="uhd06-actions">
        <button type="button">Cancel</button>
        <button type="button" className="is-dark">
          Commit & Push
        </button>
      </footer>
    </Panel>
  );
}

function BranchesHistory() {
  return (
    <Panel index="6" title="Branches & History" className="uhd06-history">
      <div className="uhd06-branch-tools">
        <label>
          <Search aria-hidden />
          Search branches
        </label>
        <button type="button">
          main <ChevronDown aria-hidden />
        </button>
        <button type="button">
          Graph <ChevronDown aria-hidden />
        </button>
      </div>
      <div className="uhd06-history-grid">
        <aside>
          {branchRows.map(([name]) => (
            <button key={name} type="button" className={name === "main" ? "is-active" : ""}>
              <GitBranch aria-hidden />
              {name}
              {name === "main" ? <span className="uhd06-branch-default">Default</span> : null}
            </button>
          ))}
          <button type="button">+ New Branch</button>
        </aside>
        <div className="uhd06-commit-graph">
          {branchRows.map(([branch, message, time, author], index) => (
            <article key={branch}>
              <span className={`node-${index}`} aria-hidden />
              <div>
                <strong>{message}</strong>
                <small>{author}</small>
              </div>
              <em>{time}</em>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ConflictResolution() {
  return (
    <Panel index="7" title="Conflict Resolution" className="uhd06-conflict">
      <div className="uhd06-conflict-actions">
        <span>
          <Settings2 aria-hidden />
          docs/guide/installation.mdx
        </span>
        <button type="button">Accept Current</button>
        <button type="button">Accept Incoming</button>
        <button type="button">Accept Both</button>
      </div>
      <div className="uhd06-conflict-code">
        <div className="is-separator">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD (Current)</div>
        <div className="is-current">Make sure you have Node.js 18 or later.</div>
        <div className="is-separator">=======</div>
        <div className="is-incoming">Ensure Node.js v20+ is installed.</div>
        <div className="is-separator">&gt;&gt;&gt;&gt;&gt;&gt;&gt; origin/main (Incoming)</div>
      </div>
      <label>
        Resolved
        <textarea defaultValue={"Ensure Node.js v20+ is installed."} />
      </label>
      <footer className="uhd06-actions">
        <button type="button" className="is-dark">
          Mark Resolved
        </button>
        <button type="button">Cancel</button>
      </footer>
    </Panel>
  );
}

function SourceSettings() {
  return (
    <Panel index="8" title="Source Settings" className="uhd06-settings">
      <div className="uhd06-settings-head">
        <strong>Verto Docs (Local)</strong>
        <span>/Users/alan/verto</span>
      </div>
      <div className="uhd06-settings-tabs">
        {["General", "File Types", "Ignore Rules", "Sync", "Advanced", "Danger Zone"].map(
          (tab, index) => (
            <button key={tab} type="button" className={index === 0 ? "is-active" : ""}>
              {tab}
            </button>
          )
        )}
      </div>
      <div className="uhd06-settings-form">
        <label>
          Name
          <input defaultValue="Verto Docs" />
        </label>
        <label>
          Path
          <input defaultValue="/Users/alan/verto" />
        </label>
        <label>
          Description
          <input defaultValue="My personal knowledge base." />
        </label>
        <label>
          Status
          <span>
            <CheckCircle2 aria-hidden /> Synced
            <button type="button">Resync now</button>
          </span>
        </label>
        <label>
          Last Sync
          <span>2 minutes ago</span>
        </label>
        <label>
          Items
          <span>1,248 documents</span>
        </label>
      </div>
    </Panel>
  );
}

function SyncActivity() {
  return (
    <Panel index="9" title="Sync Status & Activity" className="uhd06-sync">
      <div className="uhd06-panel-tools">
        <strong>Sync Activity</strong>
        <button type="button">All Sources</button>
      </div>
      <div className="uhd06-activity-list">
        {syncActivity.map(([name, detail, percent, time, tone]) => (
          <article key={name} className={`is-${tone}`}>
            <span aria-hidden />
            <div>
              <strong>{name}</strong>
              <small>{detail}</small>
            </div>
            <em>{percent}</em>
            <time>{time}</time>
          </article>
        ))}
      </div>
      <button type="button" className="uhd06-link-button">
        View all activity +
      </button>
    </Panel>
  );
}

function SourceHealth() {
  return (
    <Panel index="10" title="Source Health" className="uhd06-health">
      <div className="uhd06-health-grid">
        <div className="uhd06-donut">
          <strong>9</strong>
          <span>sources</span>
        </div>
        <div className="uhd06-health-list">
          {sourceHealth.map(([label, count, color]) => (
            <article key={label} style={{ ["--tone" as string]: color }}>
              <span aria-hidden />
              <strong>{label}</strong>
              <em>{count}</em>
            </article>
          ))}
        </div>
      </div>
      <div className="uhd06-storage">
        <strong>Storage Usage</strong>
        <span>12.6 GB indexed content</span>
        <div>
          <span style={{ width: "66%" }} />
        </div>
        <small>Local 6.2GB - Git 4.1GB - Cloud 2.1GB - Web 0.2GB</small>
      </div>
      <button type="button" className="uhd06-link-button">
        View storage details +
      </button>
    </Panel>
  );
}

function PermissionsAccess() {
  return (
    <Panel index="11" title="Permissions & Access" className="uhd06-permissions">
      <div className="uhd06-permission-form">
        <div className="uhd06-permission-head">
          <strong>GitHub (alan/verto)</strong>
          <span>Connected as alan</span>
        </div>
        <label>
          Permission
          <select defaultValue="rw">
            <option value="rw">Read &amp; Write</option>
          </select>
        </label>
        <label>
          Repositories
          <span>
            <select defaultValue="repos">
              <option value="repos">3 repositories selected</option>
            </select>
            <button type="button">Manage</button>
          </span>
        </label>
      </div>
      <div className="uhd06-danger">
        <strong>Danger Zone</strong>
        <p>Disconnect this source. This will stop syncing and remove local cache.</p>
        <button type="button">Disconnect</button>
      </div>
    </Panel>
  );
}

function OfflineState() {
  return (
    <Panel index="12" title="Offline State" className="uhd06-offline">
      <div className="uhd06-offline-card">
        <div>
          <WifiOff aria-hidden />
        </div>
        <strong>You&apos;re offline</strong>
        <p>You can keep reading and writing. Changes will sync when you&apos;re online.</p>
        <button type="button">Go to Library</button>
        <small>Last synced 2h ago</small>
      </div>
    </Panel>
  );
}

function BottomPanels() {
  return (
    <section className="uhd06-bottom-row" aria-label="Responsive behavior and states">
      <SpecBoardSection
        className="uhd06-panel uhd06-responsive"
        ariaLabel="Responsive behavior"
        headerClassName="uhd06-strip-head"
        title="Responsive Behavior"
      >
        <div className="uhd06-responsive-grid">
          {[
            [">= 1600px", "All three panels visible."],
            ["1200px - 1599px", "Right rail collapses to drawer."],
            ["1024px - 1199px", "Left rail collapses to icon rail."],
            ["< 768px", "Single column with drawers."],
          ].map(([label, body]) => (
            <article key={label}>
              <div>
                <span />
                <span />
                <span />
              </div>
              <strong>{label}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </SpecBoardSection>

      <SpecBoardSection
        className="uhd06-panel uhd06-empty-states"
        ariaLabel="Empty states"
        headerClassName="uhd06-strip-head"
        title="Empty States"
      >
        <div className="uhd06-empty-grid">
          {emptyStates.map(([title, body, action, Icon]) => (
            <article key={title}>
              <Icon aria-hidden />
              <strong>{title}</strong>
              <p>{body}</p>
              <button type="button">{action}</button>
            </article>
          ))}
        </div>
      </SpecBoardSection>

      <SpecBoardSection
        className="uhd06-panel uhd06-toasts"
        ariaLabel="Toast notifications"
        headerClassName="uhd06-strip-head"
        title="Toast Notifications"
      >
        {toastRows.map(([tone, title, action]) => (
          <article key={title} className={`is-${tone}`}>
            <span aria-hidden />
            <strong>{title}</strong>
            <button type="button">{action}</button>
          </article>
        ))}
      </SpecBoardSection>

      <SpecBoardSection
        className="uhd06-panel uhd06-theme"
        ariaLabel="Theme preview"
        headerClassName="uhd06-strip-head"
        title="Theme Preview"
      >
        <div className="uhd06-theme-grid">
          {["Light Theme (Default)", "Dark Theme"].map((title, index) => (
            <article key={title} className={index === 1 ? "is-dark" : ""}>
              <div>
                <strong>V</strong>
                <span>verto</span>
                <MoreHorizontal aria-hidden />
              </div>
              {["Verto Docs (Local)", "Verto (GitHub)", "Personal Notes"].map((row) => (
                <p key={row}>
                  <FileText aria-hidden />
                  <span>{row}</span>
                  <Check aria-hidden />
                  <small>Synced</small>
                </p>
              ))}
            </article>
          ))}
        </div>
      </SpecBoardSection>
    </section>
  );
}

export default function SourcesWorkflowView({ connection }: SourcesWorkflowViewProps) {
  return (
    <SpecBoardPageShell
      className="uhd06-page"
      ariaLabel="Sources, integrations and Git workflow"
      rail={<SourceRail />}
      main={
        <main className="uhd06-main">
          <SpecBoardHeader
            className="uhd06-board-head"
            eyebrow="06"
            eyebrowClassName="uhd06-kicker"
            title="Sources, Integrations & Git Workflow"
            description="All your knowledge, always in sync."
          >
            <SpecBoardSearchPrompt label="Search anything..." shortcut="⌘K" />
          </SpecBoardHeader>

          <div className="uhd06-grid">
            <ProductNav />
            <SourcesOverview connection={connection} />
            <AddSourceFlow />
            <GitChanges />
            <FileDiff />
            <CommitChanges />
            <BranchesHistory />
            <ConflictResolution />
            <SourceSettings />
            <SyncActivity />
            <SourceHealth />
            <PermissionsAccess />
            <OfflineState />
            <BottomPanels />
          </div>
        </main>
      }
    />
  );
}
