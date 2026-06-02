import { Cloud, Github, HardDrive, HelpCircle } from "lucide-react";
import type { SourceInfo } from "@/lib/source-info";

const SOURCE_ICON = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
} as const;

/**
 * Right-rail informational panels shown beneath the table of contents: a
 * live "Connected to <source>" card driven by the active content source, and
 * a static "Need help?" card.
 */
export default function RightRailPanels({ source }: { source: SourceInfo }) {
  const Icon = SOURCE_ICON[source.kind];

  return (
    <>
      <section className="rail-panel source-panel" aria-label="Source status">
        <div className="source-panel-head">
          <Icon className="source-panel-icon" aria-hidden />
          <span className="source-panel-title">Connected to {source.name}</span>
          <span className="source-panel-badge">
            <span className="source-panel-badge-dot" aria-hidden />
            Connected
          </span>
        </div>

        <dl className="source-panel-rows">
          {source.repo ? (
            <div className="source-panel-row">
              <dt>Repository</dt>
              <dd>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-panel-link"
                  >
                    {source.repo}
                    <span aria-hidden> ↗</span>
                  </a>
                ) : (
                  source.repo
                )}
              </dd>
            </div>
          ) : (
            <div className="source-panel-row">
              <dt>Source</dt>
              <dd>{source.label}</dd>
            </div>
          )}

          {source.branch && (
            <div className="source-panel-row">
              <dt>Branch</dt>
              <dd>{source.branch}</dd>
            </div>
          )}

          <div className="source-panel-row">
            <dt>Last checked</dt>
            <dd>at build</dd>
          </div>
        </dl>

        <div className="source-panel-preview">
          <span>Preview from source</span>
          <span className="source-panel-preview-dot" aria-hidden />
        </div>

        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-panel-button"
          >
            Open in {source.kind === "github" ? "GitHub" : source.name}
            <span aria-hidden> ↗</span>
          </a>
        )}
      </section>

      <section className="rail-panel help-panel" aria-label="Help">
        <div className="help-panel-head">
          <HelpCircle className="help-panel-icon" aria-hidden />
          <span className="help-panel-title">Need help?</span>
        </div>
        <p className="help-panel-text">
          Check out our guides or reach out to the community.
        </p>
        <a
          href="https://github.com/tsaiggo/verto"
          target="_blank"
          rel="noopener noreferrer"
          className="help-panel-link"
        >
          Visit MDX Support
          <span aria-hidden> ↗</span>
        </a>
      </section>
    </>
  );
}
