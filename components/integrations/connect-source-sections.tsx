"use client";

// Presentational sections of the Connect-source view: status badge, provider
// cards, connection form, and the setup/preview/notes aside.
import type { Dispatch, SetStateAction } from "react";
import { Check, ChevronDown, ExternalLink, Github, Info } from "lucide-react";
import { toast } from "sonner";
import type { ConnectionDetails } from "@/lib/connection-info";
import { useAuth } from "@/components/auth/AuthProvider";
import GitHubConnectPanel from "@/components/integrations/GitHubConnectPanel";
import LocalConnectPanel from "@/components/integrations/LocalConnectPanel";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import { Button } from "@/components/ui/button";
import {
  PROVIDERS,
  isConnectedProvider,
  type ChecklistItem,
  type FormField,
  type PreviewRow,
  type ProviderKind,
  type SetupStep,
} from "@/components/integrations/connect-source-data";

type ProviderMeta = (typeof PROVIDERS)[number];

export function ConnectStatusBadge({ connected }: { connected: boolean }) {
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

export function ProviderCards({
  selected,
  setSelected,
  connection,
}: {
  selected: ProviderKind;
  setSelected: Dispatch<SetStateAction<ProviderKind>>;
  connection: ConnectionDetails;
}) {
  return (
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
            <span className="connect-card-top">
              <span className={`connect-card-icon ${p.iconClass}`} aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="connect-card-pill">{p.badge}</span>
            </span>
            <span className="connect-card-name">{p.name}</span>
            <span className="connect-card-blurb">{p.blurb}</span>
            <span className="connect-card-foot">
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
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ConnectFormSection({
  selected,
  localFolder,
  setLocalFolder,
  liveGitHub,
  auth,
  selectedMeta,
  fields,
  remote,
  setRemote,
  connectedHere,
  onSave,
}: {
  selected: ProviderKind;
  localFolder: string;
  setLocalFolder: Dispatch<SetStateAction<string>>;
  liveGitHub: boolean;
  auth: ReturnType<typeof useAuth>;
  selectedMeta: ProviderMeta;
  fields: FormField[];
  remote: boolean;
  setRemote: Dispatch<SetStateAction<boolean>>;
  connectedHere: boolean;
  onSave: () => void;
}) {
  return selected === "local" ? (
    <LocalConnectPanel folder={localFolder} onFolderChange={setLocalFolder} />
  ) : liveGitHub ? (
    auth.user ? (
      <GitHubConnectPanel />
    ) : (
      <section className="connect-form" aria-label="Sign in to connect GitHub">
        <h2 className="connect-form-title">GitHub connection</h2>
        <p className="connect-field-help">
          Sign in with your GitHub account to list your repositories and connect one. Use the “Sign
          in” button in the top bar.
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
                  toast.error(`Sign-in failed: ${err instanceof Error ? err.message : String(err)}`)
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
  );
}

export function ConnectAside({
  setupSteps,
  previewRows,
  connectedHere,
  connection,
  selected,
  selectedMeta,
  checklist,
}: {
  setupSteps: SetupStep[];
  previewRows: PreviewRow[];
  connectedHere: boolean;
  connection: ConnectionDetails;
  selected: ProviderKind;
  selectedMeta: ProviderMeta;
  checklist: ChecklistItem[];
}) {
  return (
    <aside className="connect-aside" aria-label="Setup and source preview">
      <ol className="connect-setup-steps" aria-label="Setup progress">
        {setupSteps.map((step) => (
          <li className={`connect-setup-step is-${step.tone}`} key={step.label}>
            <span className="connect-setup-index">
              {step.tone === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : step.label}
            </span>
            <span className="connect-setup-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
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
  );
}
