"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Cloud,
  ExternalLink,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Github,
  HardDrive,
  Info,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ConnectionDetails } from "@/lib/connection-info";
import { useAuth } from "@/components/auth/AuthProvider";
import GitHubConnectPanel from "@/components/integrations/GitHubConnectPanel";
import LocalConnectPanel from "@/components/integrations/LocalConnectPanel";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import { Button } from "@/components/ui/button";

type ProviderKind = "local" | "github" | "onedrive" | "googledrive";

interface ConnectSourceViewProps {
  connection: ConnectionDetails;
}

const PROVIDERS: {
  kind: ProviderKind;
  name: string;
  blurb: string;
  badge: string;
  note: string;
  icon: LucideIcon;
  iconClass: string;
  comingSoon?: boolean;
}[] = [
  {
    kind: "local",
    name: "Local Files",
    blurb: "Open a folder of .mdx / .md files from this device.",
    badge: "Recommended",
    note: "No account required",
    icon: FolderOpen,
    iconClass: "is-local",
  },
  {
    kind: "github",
    name: "GitHub Repo",
    blurb: "Connect a public or private GitHub repository.",
    badge: "Desktop live",
    note: "Best for synced vaults",
    icon: Github,
    iconClass: "is-github",
  },
  {
    kind: "onedrive",
    name: "OneDrive",
    blurb: "Connect to your Microsoft OneDrive storage.",
    badge: "Build-time",
    note: "Configure with env vars",
    icon: Cloud,
    iconClass: "is-onedrive",
  },
  {
    kind: "googledrive",
    name: "Google Drive",
    blurb: "Google Drive support is coming soon.",
    badge: "Coming soon",
    note: "Not available yet",
    icon: HardDrive,
    iconClass: "is-googledrive",
    comingSoon: true,
  },
];

interface FormField {
  id: string;
  label: string;
  /** "select" renders a chevron + (optional) verified check, "text" is plain. */
  type: "select" | "text";
  value: string;
  help?: string;
  verified?: boolean;
}

interface PreviewRow {
  label: string;
  value: string;
  icon: LucideIcon;
  mono?: boolean;
}

/** Does the selected provider correspond to the actually-connected source? */
export function isConnectedProvider(
  provider: ProviderKind,
  connection: ConnectionDetails
): boolean {
  return connection.connected && connection.kind === provider;
}

export function initialProviderFor(connection: ConnectionDetails): ProviderKind {
  return PROVIDERS.some((p) => p.kind === connection.kind) ? connection.kind : "github";
}

/** Build the connection-form fields for a provider. */
export function fieldsFor(provider: ProviderKind, connection: ConnectionDetails): FormField[] {
  const connected = isConnectedProvider(provider, connection);

  if (provider === "github") {
    return [
      {
        id: "repository",
        label: "Repository",
        type: "select",
        value: connection.repo ?? "owner/repo",
        help: "Select a repository you have access to.",
        verified: connected,
      },
      {
        id: "branch",
        label: "Branch",
        type: "select",
        value: connection.branch ?? "main",
        help: "Select the branch to read from.",
        verified: connected,
      },
      {
        id: "path",
        label: "Content path",
        type: "text",
        value: connected ? connection.path : "/docs",
        help: "Path within the repository where your MDX content lives.",
      },
      {
        id: "filter",
        label: "File filter",
        type: "text",
        value: connection.filter,
        help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
      },
    ];
  }

  if (provider === "onedrive") {
    return [
      {
        id: "account",
        label: "Account",
        type: "select",
        value: connected ? connection.name : "Connect an account",
        help: "Sign in with the Microsoft account that owns the files.",
        verified: connected,
      },
      {
        id: "path",
        label: "Folder path",
        type: "text",
        value: connected ? connection.path : "/Documents/MDX",
        help: "Folder inside OneDrive where your MDX content lives.",
      },
      {
        id: "filter",
        label: "File filter",
        type: "text",
        value: connection.filter,
        help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
      },
    ];
  }

  return [
    {
      id: "account",
      label: "Account",
      type: "select",
      value: "Connect an account",
      help: "Sign in with the Google account that owns the files.",
    },
    {
      id: "folder",
      label: "Folder",
      type: "select",
      value: "Select a folder",
      help: "Choose the Drive folder to read from.",
    },
    {
      id: "filter",
      label: "File filter",
      type: "text",
      value: connection.filter,
      help: "Only files matching this pattern will be previewed. Supports .mdx and .md only.",
    },
  ];
}

/** Build the right-hand "Source preview" rows for a provider. */
export function previewRowsFor(
  provider: ProviderKind,
  connection: ConnectionDetails,
  fields: FormField[],
  localFolder: string
): PreviewRow[] {
  const byId = (id: string) => fields.find((f) => f.id === id)?.value ?? "—";
  const providerName = PROVIDERS.find((p) => p.kind === provider)?.name ?? provider;
  const providerLabel = provider === "github" ? "GitHub" : providerName;

  if (provider === "local") {
    return [
      { label: "Provider", value: "Local Files", icon: FolderOpen },
      {
        label: "Folder",
        value: localFolder.trim() || "—",
        icon: Folder,
        mono: true,
      },
      {
        label: "File filter",
        value: connection.filter,
        icon: GitCommitHorizontal,
        mono: true,
      },
      { label: "Preview mode", value: "Local preview", icon: HardDrive },
    ];
  }

  if (provider === "github") {
    return [
      { label: "Provider", value: providerLabel, icon: Github },
      {
        label: "Repository",
        value: byId("repository"),
        icon: Folder,
        mono: true,
      },
      { label: "Branch", value: byId("branch"), icon: GitBranch, mono: true },
      { label: "Path", value: byId("path"), icon: Folder, mono: true },
      {
        label: "File filter",
        value: byId("filter"),
        icon: GitCommitHorizontal,
        mono: true,
      },
      {
        label: "Preview mode",
        value: connection.previewMode,
        icon: RefreshCw,
      },
    ];
  }

  return [
    {
      label: "Provider",
      value: providerLabel,
      icon: provider === "onedrive" ? Cloud : HardDrive,
    },
    {
      label: "Folder",
      value: byId("path") ?? byId("folder"),
      icon: Folder,
      mono: true,
    },
    {
      label: "File filter",
      value: byId("filter"),
      icon: GitCommitHorizontal,
      mono: true,
    },
    { label: "Preview mode", value: "Remote preview", icon: RefreshCw },
  ];
}

interface SetupStep {
  label: string;
  title: string;
  detail: string;
  tone: "done" | "active" | "todo";
}

interface ChecklistItem {
  icon: LucideIcon;
  tone: "ok" | "sync" | "info";
  title: string;
  detail: string;
}

function checklistFor(
  provider: ProviderKind,
  desktop: boolean,
  signedIn: boolean
): ChecklistItem[] {
  if (provider === "local") {
    return [
      {
        icon: FolderOpen,
        tone: "sync",
        title: desktop ? "Use the native picker" : "Enter a folder path",
        detail: desktop
          ? "Choose any folder on this computer and Verto will scan it for readable files."
          : "The browser build cannot open folders directly; use the desktop app for picker access.",
      },
      {
        icon: CircleCheck,
        tone: "ok",
        title: "Look for .md or .mdx",
        detail: "The scanner ignores dotfiles and non-readable assets so your library stays clean.",
      },
      {
        icon: RefreshCw,
        tone: "info",
        title: "Rebuild when changing sources",
        detail:
          "Verto is static-first, so source changes are applied during the next build/export.",
      },
    ];
  }

  if (provider === "github") {
    return [
      {
        icon: Github,
        tone: signedIn ? "ok" : "sync",
        title: signedIn ? "GitHub account ready" : "Sign in with GitHub",
        detail: signedIn
          ? "Pick a repository, branch, and content folder from your account."
          : "The desktop app uses GitHub device flow and stores the token on this device.",
      },
      {
        icon: GitBranch,
        tone: "info",
        title: "Verify the content path",
        detail: "Verto checks the selected repository path before saving the connection.",
      },
      {
        icon: CircleCheck,
        tone: "ok",
        title: "Private repos are supported",
        detail: "Use a signed-in desktop session when your MDX vault is not public.",
      },
    ];
  }

  return [
    {
      icon: Cloud,
      tone: "info",
      title: "Configure outside the app",
      detail: "OneDrive sources currently use environment variables and build-time validation.",
    },
    {
      icon: GitCommitHorizontal,
      tone: "sync",
      title: "Keep the MDX filter",
      detail: "Only .md and .mdx files are read into the generated site.",
    },
    {
      icon: RefreshCw,
      tone: "ok",
      title: "Rebuild to apply",
      detail: "After changing remote source settings, export the app again to refresh content.",
    },
  ];
}

function setupStepsFor(
  selected: ProviderKind,
  auth: ReturnType<typeof useAuth>,
  localFolder: string,
  connection: ConnectionDetails
): SetupStep[] {
  const hasLocalFolder = localFolder.trim().length > 0;
  const hasSavedGitHubConnection = Boolean(auth.connection);
  const hasChosenVault =
    hasLocalFolder || connection.connected || (selected === "github" && hasSavedGitHubConnection);
  const hasReadableSource = connection.connected || hasLocalFolder || hasSavedGitHubConnection;
  return [
    {
      label: "01",
      title: "Choose your vault",
      detail:
        selected === "local"
          ? "Start with a folder on this computer."
          : "Pick the place where your MDX lives.",
      tone: hasChosenVault ? "done" : "active",
    },
    {
      label: "02",
      title: "Verify access",
      detail: auth.user
        ? `Signed in as @${auth.user.login}.`
        : auth.available
          ? "Sign in only if your vault is on GitHub."
          : "Desktop unlocks native folder and GitHub flows.",
      tone: auth.user || selected === "local" ? "done" : "active",
    },
    {
      label: "03",
      title: "Start reading",
      detail: hasReadableSource
        ? "Your reader has a source to render."
        : "Save the connection, then rebuild when needed.",
      tone: hasReadableSource ? "done" : "todo",
    },
  ];
}

function ConnectStatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`connect-badge${connected ? " is-connected" : " is-idle"}`}>
      {connected ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <span className="connect-dot" aria-hidden />
      )}
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

/**
 * Client view for the Integrations / Connect source page. Renders the provider
 * cards, the connection form, and the right-hand source-preview and
 * recent-activity panels. Verto reads content at build time, so the form is a
 * presentational reflection of the configured source — "Save & connect"
 * explains how connections are actually applied rather than persisting state.
 */
export default function ConnectSourceView({ connection }: ConnectSourceViewProps) {
  const initialProvider = initialProviderFor(connection);

  const [selected, setSelected] = useState<ProviderKind>(initialProvider);
  const [remote, setRemote] = useState(connection.remote);
  const [localFolder, setLocalFolder] = useState(() =>
    connection.kind === "local" && connection.path !== "/" ? connection.path : ""
  );

  const auth = useAuth();
  // The interactive GitHub flow is desktop-only. In the browser build (or
  // before the user signs in) we fall back to the presentational form, which
  // reflects the build-time `VERTO_CONTENT_SOURCE` configuration.
  const liveGitHub = selected === "github" && auth.available;

  const fields = useMemo(() => fieldsFor(selected, connection), [selected, connection]);
  const previewRows = useMemo(
    () => previewRowsFor(selected, connection, fields, localFolder),
    [selected, connection, fields, localFolder]
  );
  const connectedHere = isConnectedProvider(selected, connection);
  const selectedMeta = PROVIDERS.find((p) => p.kind === selected) ?? PROVIDERS[0];
  const setupSteps = useMemo(
    () => setupStepsFor(selected, auth, localFolder, connection),
    [selected, auth, localFolder, connection]
  );
  const checklist = useMemo(
    () => checklistFor(selected, auth.available, Boolean(auth.user)),
    [selected, auth.available, auth.user]
  );

  const onSave = () => {
    toast("Connections are configured at build time", {
      description:
        "Verto previews from the source set via VERTO_CONTENT_SOURCE. Update your environment and rebuild to switch sources.",
    });
  };

  return (
    <div className="connect-page">
      <div className="connect-main">
        <header className="connect-hero">
          <div className="connect-hero-copy">
            <span className="connect-eyebrow">Library source</span>
            <h1 className="connect-title">Choose a source for this library.</h1>
            <p className="connect-subtitle">
              Verto reads .mdx and .md files from one source at a time. Start with a folder on this
              device, or connect GitHub when your notes live in a repository.
            </p>
            <div className="connect-hero-actions">
              <Button type="button" onClick={() => setSelected("local")}>
                <FolderOpen className="h-4 w-4" aria-hidden /> Open local folder
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelected("github")}>
                <Github className="h-4 w-4" aria-hidden /> Connect GitHub
              </Button>
            </div>
          </div>
          <ol className="connect-setup-steps" aria-label="Setup progress">
            {setupSteps.map((step) => (
              <li className={`connect-setup-step is-${step.tone}`} key={step.label}>
                <span className="connect-setup-index">
                  {step.tone === "done" ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    step.label
                  )}
                </span>
                <span className="connect-setup-copy">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </header>

        <div className="connect-cards">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            const isSelected = p.kind === selected;
            const isConnected = isConnectedProvider(p.kind, connection);
            const isComingSoon = p.comingSoon ?? false;
            return (
              <button
                type="button"
                key={p.kind}
                className={`connect-card${isSelected ? " is-selected" : ""}${
                  isComingSoon ? " is-coming-soon" : ""
                }`}
                aria-pressed={isComingSoon ? undefined : isSelected}
                disabled={isComingSoon}
                onClick={isComingSoon ? undefined : () => setSelected(p.kind)}
              >
                {isSelected && !isComingSoon && (
                  <span className="connect-card-check" aria-hidden>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className={`connect-card-icon ${p.iconClass}`} aria-hidden>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="connect-card-pill">{p.badge}</span>
                <span className="connect-card-name">{p.name}</span>
                <span className="connect-card-blurb">{p.blurb}</span>
                <span className="connect-card-note">{p.note}</span>
                {isComingSoon ? (
                  <span className="connect-card-soon">Coming soon</span>
                ) : isConnected ? (
                  <span className="connect-card-status">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <span className="connect-card-connect">Connect</span>
                )}
              </button>
            );
          })}
        </div>

        {selected === "local" ? (
          <LocalConnectPanel folder={localFolder} onFolderChange={setLocalFolder} />
        ) : liveGitHub ? (
          auth.user ? (
            <GitHubConnectPanel />
          ) : (
            <section className="connect-form" aria-label="Sign in to connect GitHub">
              <h2 className="connect-form-title">GitHub connection</h2>
              <p className="connect-field-help">
                Sign in with your GitHub account to list your repositories and connect one. Use the
                “Sign in” button in the top bar.
              </p>
              <div className="connect-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void auth
                      .signIn((info) =>
                        toast.info(`Enter code ${info.userCode} on GitHub`, {
                          description: "We opened the verification page in your browser.",
                          duration: 30000,
                        })
                      )
                      .then(() => toast.success("Signed in to GitHub."))
                      .catch((err: unknown) =>
                        toast.error(
                          `Sign-in failed: ${err instanceof Error ? err.message : String(err)}`
                        )
                      )
                  }
                >
                  <Github className="h-4 w-4" aria-hidden />
                  Sign in with GitHub
                </Button>
              </div>
            </section>
          )
        ) : (
          <section className="connect-form" aria-label={`${selectedMeta.name} connection`}>
            <h2 className="connect-form-title">{selectedMeta.name} connection</h2>

            {fields.map((field) => (
              <div className="connect-field" key={field.id}>
                <label className="connect-field-label" htmlFor={`field-${field.id}`}>
                  {field.label}
                </label>
                <div className="connect-field-control">
                  <div className="connect-input-wrap">
                    <input
                      id={`field-${field.id}`}
                      className="connect-input"
                      defaultValue={field.value}
                      readOnly={field.type === "select"}
                      aria-readonly={field.type === "select"}
                      spellCheck={false}
                    />
                    {field.type === "select" && (
                      <span className="connect-input-adorn" aria-hidden>
                        {field.verified && (
                          <span className="connect-verified">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 connect-input-chevron" />
                      </span>
                    )}
                  </div>
                  {field.help && <p className="connect-field-help">{field.help}</p>}
                </div>
              </div>
            ))}

            <div className="connect-field">
              <span className="connect-field-label">Preview mode</span>
              <div className="connect-field-control">
                <div className="connect-toggle-row">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={remote}
                    aria-label="Remote preview"
                    className={`connect-switch${remote ? " is-on" : ""}`}
                    onClick={() => setRemote((v) => !v)}
                  >
                    <span className="connect-switch-thumb" aria-hidden />
                  </button>
                  <span className="connect-toggle-label">Remote preview</span>
                  <Info className="connect-toggle-info" aria-hidden />
                </div>
                <p className="connect-field-help">
                  {remote
                    ? "Preview files directly from the source. Nothing is imported or stored."
                    : "Files are read from the local content directory at build time."}
                </p>
              </div>
            </div>

            <div className="connect-form-actions">
              <Button type="button" onClick={onSave}>
                Save &amp; connect
              </Button>
              {connectedHere && (
                <span className="connect-form-status">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Connection successful
                </span>
              )}
            </div>
          </section>
        )}
      </div>

      <aside className="connect-aside" aria-label="Source preview">
        <section className="connect-panel">
          <div className="connect-panel-head">
            <h2 className="connect-panel-title">Source preview</h2>
            <ConnectStatusBadge connected={connectedHere} />
          </div>

          <dl className="connect-preview">
            {previewRows.map((row) => {
              const RowIcon = row.icon;
              return (
                <div className="connect-preview-row" key={row.label}>
                  <dt className="connect-preview-label">
                    <RowIcon className="connect-preview-icon" aria-hidden />
                    {row.label}
                  </dt>
                  <dd className={`connect-preview-value${row.mono ? " is-mono" : ""}`}>
                    {row.value}
                  </dd>
                </div>
              );
            })}
          </dl>

          {connection.url && connectedHere ? (
            <a
              className="connect-open"
              href={connection.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {selected === "github" ? "repository" : "source"}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : (
            <button type="button" className="connect-open" disabled>
              Open {selected === "github" ? "repository" : "source"}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </button>
          )}
        </section>

        <section className="connect-panel connect-panel-accent">
          <div className="connect-panel-head">
            <h2 className="connect-panel-title">Source notes</h2>
            <span className="connect-panel-kicker">{selectedMeta.name}</span>
          </div>

          <ul className="connect-activity">
            {checklist.map((item) => {
              const ItemIcon = item.icon;
              return (
                <li className="connect-activity-item" key={item.title}>
                  <span className={`connect-activity-icon tone-${item.tone}`} aria-hidden>
                    <ItemIcon className="h-4 w-4" />
                  </span>
                  <span className="connect-activity-body">
                    <span className="connect-activity-title">{item.title}</span>
                    <span className="connect-activity-detail">{item.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <AssistantConnectPanel />
      </aside>
    </div>
  );
}
