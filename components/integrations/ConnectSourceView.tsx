"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  Cloud,
  ExternalLink,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Github,
  HardDrive,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { ConnectionDetails } from "@/lib/connection-info";
import type { SourceKind } from "@/lib/source-info";

type ProviderKind = "github" | "onedrive" | "googledrive";

interface ConnectSourceViewProps {
  connection: ConnectionDetails;
}

const PROVIDERS: {
  kind: ProviderKind;
  name: string;
  blurb: string;
  icon: typeof Github;
  iconClass: string;
}[] = [
  {
    kind: "github",
    name: "GitHub Repo",
    blurb: "Connect a public or private GitHub repository.",
    icon: Github,
    iconClass: "is-github",
  },
  {
    kind: "onedrive",
    name: "OneDrive",
    blurb: "Connect to your Microsoft OneDrive storage.",
    icon: Cloud,
    iconClass: "is-onedrive",
  },
  {
    kind: "googledrive",
    name: "Google Drive",
    blurb: "Connect to your Google Drive storage.",
    icon: HardDrive,
    iconClass: "is-googledrive",
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
  icon: typeof Github;
  mono?: boolean;
}

/** Does the selected provider correspond to the actually-connected source? */
function isConnectedProvider(
  provider: ProviderKind,
  connection: ConnectionDetails,
): boolean {
  return (
    connection.connected && (connection.kind as SourceKind) === provider
  );
}

/** Build the connection-form fields for a provider. */
function fieldsFor(
  provider: ProviderKind,
  connection: ConnectionDetails,
): FormField[] {
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
function previewRowsFor(
  provider: ProviderKind,
  connection: ConnectionDetails,
  fields: FormField[],
): PreviewRow[] {
  const byId = (id: string) => fields.find((f) => f.id === id)?.value ?? "—";
  const providerName =
    PROVIDERS.find((p) => p.kind === provider)?.name ?? provider;
  const providerLabel = provider === "github" ? "GitHub" : providerName;

  if (provider === "github") {
    return [
      { label: "Provider", value: providerLabel, icon: Github },
      { label: "Repository", value: byId("repository"), icon: Folder, mono: true },
      { label: "Branch", value: byId("branch"), icon: GitBranch, mono: true },
      { label: "Path", value: byId("path"), icon: Folder, mono: true },
      { label: "File filter", value: byId("filter"), icon: GitCommitHorizontal, mono: true },
      {
        label: "Preview mode",
        value: connection.previewMode,
        icon: RefreshCw,
      },
    ];
  }

  return [
    { label: "Provider", value: providerLabel, icon: provider === "onedrive" ? Cloud : HardDrive },
    { label: "Folder", value: byId("path") ?? byId("folder"), icon: Folder, mono: true },
    { label: "File filter", value: byId("filter"), icon: GitCommitHorizontal, mono: true },
    { label: "Preview mode", value: "Remote preview", icon: RefreshCw },
  ];
}

interface ActivityItem {
  icon: typeof Github;
  tone: "ok" | "sync" | "info";
  title: string;
  detail: string;
  time: string;
}

function activityFor(connection: ConnectionDetails): ActivityItem[] {
  const target = connection.repo ?? connection.name;
  return [
    {
      icon: CircleCheck,
      tone: "ok",
      title: `Connected to ${target}`,
      detail: `${connection.previewMode} enabled`,
      time: "2m ago",
    },
    {
      icon: RefreshCw,
      tone: "sync",
      title: "Synced preview",
      detail: "Scanned content files",
      time: "2m ago",
    },
    {
      icon: CircleCheck,
      tone: "ok",
      title: "Connection verified",
      detail: "Source access confirmed",
      time: "2m ago",
    },
    {
      icon: GitBranch,
      tone: "info",
      title: connection.branch ? "Branch updated" : "Source updated",
      detail: connection.branch
        ? `${connection.branch} synced`
        : "Latest content synced",
      time: "1h ago",
    },
  ];
}

/**
 * Client view for the Integrations / Connect source page. Renders the provider
 * cards, the connection form, and the right-hand source-preview and
 * recent-activity panels. Verto reads content at build time, so the form is a
 * presentational reflection of the configured source — "Save & connect"
 * explains how connections are actually applied rather than persisting state.
 */
export default function ConnectSourceView({
  connection,
}: ConnectSourceViewProps) {
  const initialProvider: ProviderKind = PROVIDERS.some(
    (p) => p.kind === connection.kind,
  )
    ? (connection.kind as ProviderKind)
    : "github";

  const [selected, setSelected] = useState<ProviderKind>(initialProvider);
  const [remote, setRemote] = useState(connection.remote);

  const fields = useMemo(
    () => fieldsFor(selected, connection),
    [selected, connection],
  );
  const previewRows = useMemo(
    () => previewRowsFor(selected, connection, fields),
    [selected, connection, fields],
  );
  const activity = useMemo(() => activityFor(connection), [connection]);

  const connectedHere = isConnectedProvider(selected, connection);
  const selectedMeta =
    PROVIDERS.find((p) => p.kind === selected) ?? PROVIDERS[0];

  const onSave = () => {
    toast("Connections are configured at build time", {
      description:
        "Verto previews from the source set via VERTO_CONTENT_SOURCE. Update your environment and rebuild to switch sources.",
    });
  };

  return (
    <div className="connect-page">
      <div className="connect-main">
        <header className="connect-head">
          <h1 className="connect-title">Connect source</h1>
          <p className="connect-subtitle">
            Connect remote sources and preview MDX content instantly.
          </p>
        </header>

        <div className="connect-banner" role="note">
          <span className="connect-banner-icon" aria-hidden>
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="connect-banner-text">
            <strong>Verto reads files remotely.</strong>
            <span>
              We preview MDX content without importing or storing your files.
            </span>
          </span>
        </div>

        <div className="connect-cards">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            const isSelected = p.kind === selected;
            const isConnected = isConnectedProvider(p.kind, connection);
            return (
              <button
                type="button"
                key={p.kind}
                className={`connect-card${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(p.kind)}
              >
                {isSelected && (
                  <span className="connect-card-check" aria-hidden>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className={`connect-card-icon ${p.iconClass}`} aria-hidden>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="connect-card-name">{p.name}</span>
                <span className="connect-card-blurb">{p.blurb}</span>
                {isConnected ? (
                  <span className="connect-card-status">
                    <span className="connect-dot" aria-hidden />
                    Connected
                  </span>
                ) : (
                  <span className="connect-card-connect">Connect</span>
                )}
              </button>
            );
          })}
        </div>

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
                {field.help && (
                  <p className="connect-field-help">{field.help}</p>
                )}
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
            <button type="button" className="connect-save" onClick={onSave}>
              Save &amp; connect
            </button>
            {connectedHere && (
              <span className="connect-form-status">
                <span className="connect-dot" aria-hidden />
                Connection successful
              </span>
            )}
          </div>
        </section>
      </div>

      <aside className="connect-aside" aria-label="Source preview">
        <section className="connect-panel">
          <div className="connect-panel-head">
            <h2 className="connect-panel-title">Source preview</h2>
            <span
              className={`connect-badge${connectedHere ? " is-connected" : " is-idle"}`}
            >
              <span className="connect-dot" aria-hidden />
              {connectedHere ? "Connected" : "Not connected"}
            </span>
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
                  <dd
                    className={`connect-preview-value${row.mono ? " is-mono" : ""}`}
                  >
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

        <section className="connect-panel">
          <div className="connect-panel-head">
            <h2 className="connect-panel-title">Recent activity</h2>
            <button
              type="button"
              className="connect-panel-refresh"
              aria-label="Refresh activity"
              onClick={() =>
                toast("Activity is illustrative", {
                  description: "Verto renders content at build time.",
                })
              }
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <ul className="connect-activity">
            {activity.map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <li className="connect-activity-item" key={i}>
                  <span
                    className={`connect-activity-icon tone-${item.tone}`}
                    aria-hidden
                  >
                    <ItemIcon className="h-4 w-4" />
                  </span>
                  <span className="connect-activity-body">
                    <span className="connect-activity-title">{item.title}</span>
                    <span className="connect-activity-detail">
                      {item.detail}
                    </span>
                  </span>
                  <time className="connect-activity-time">{item.time}</time>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="connect-activity-more"
            onClick={() =>
              toast("Full activity isn't available", {
                description: "Verto is a build-time reader with no event log.",
              })
            }
          >
            View full activity
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </section>
      </aside>
    </div>
  );
}
