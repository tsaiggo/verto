import Link from "next/link";
import {
  ArrowUp,
  Circle,
  HardDrive,
  MessageSquareText,
  Mic,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";

export default function HomeCommandComposer({
  sourceLabel,
  statusLabel = "Library ready",
}: {
  sourceLabel: string;
  statusLabel?: string;
}) {
  return (
    <section className="codex-home-composer" aria-labelledby="codex-home-composer-title">
      <div className="codex-home-run-status" role="status">
        <Circle className="codex-home-run-indicator" aria-hidden />
        <span>{statusLabel}</span>
      </div>
      <h2 id="codex-home-composer-title" className="sr-only">
        Search or ask your workspace
      </h2>
      <form className="codex-home-search" action="/search" method="get" role="search">
        <label className="sr-only" htmlFor="codex-home-search-input">
          Search your workspace
        </label>
        <input
          id="codex-home-search-input"
          className="codex-home-search-input"
          type="search"
          name="q"
          placeholder="Search your workspace"
          autoComplete="off"
          enterKeyHint="search"
        />

        <div className="codex-home-composer-footer">
          <div className="codex-home-composer-actions">
            <Link
              href="/integrations"
              className="codex-home-source-link is-icon"
              aria-label="Add or manage content sources"
            >
              <Plus aria-hidden />
            </Link>
            <Link
              href="/integrations"
              className="codex-home-ask-link"
              aria-label="Review source access"
            >
              <ShieldCheck aria-hidden />
              <span>Source access</span>
            </Link>
          </div>

          <div className="codex-home-composer-tools">
            <span className="codex-home-source-name" title={sourceLabel}>
              <HardDrive aria-hidden />
              {sourceLabel}
            </span>
            <Link href="/agent" className="codex-home-model-link">
              <MessageSquareText aria-hidden />
              <span>Verto Agent</span>
            </Link>
            <button
              type="button"
              className="codex-home-mic"
              aria-label="Voice input unavailable"
              disabled
            >
              <Mic aria-hidden />
            </button>
            <button type="submit" className="codex-home-submit" aria-label="Search workspace">
              <Search className="codex-home-submit-search" aria-hidden />
              <ArrowUp className="codex-home-submit-arrow" aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
