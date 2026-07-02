"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cloud, FileText, Github, HardDrive, Menu, Puzzle, Search, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ReadingSettings from "@/components/ui/ReadingSettings";
import UpdateCheck from "@/components/desktop/UpdateCheck";
import GitHubLogin from "@/components/auth/GitHubLogin";
import TopBarAccount from "@/components/layout/TopBarAccount";
import TopBarVault from "@/components/layout/TopBarVault";
import type { SourceInfo } from "@/lib/source-info";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
import { getAssistantConfig } from "@/lib/ai";

interface TopBarProps {
  source: SourceInfo;
  /** Opens the mobile navigation drawer. */
  onMenu: () => void;
}

const SOURCE_ICON = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
} as const;

/**
 * Sticky top bar of the main region. On the left, a source ("vault") pill and a
 * source-prefixed breadcrumb of the current document; on the right, the
 * workspace action cluster: an inline Cmd-K search pill, a Read / Edit view
 * segment and an Ask control (document routes only), plus the reading / theme /
 * account controls.
 */
export default function TopBar({ source, onMenu }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const SourceIcon = SOURCE_ICON[source.kind];

  // ⌘K / Ctrl-K opens the Search & Library page from anywhere in the shell.
  // The search page focuses its own input once it mounts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (pathname === "/search") return;
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  // Build breadcrumb crumbs. Documents live under `/read/<…segments>`; the
  // GitHub owner/repo is prefixed (non-navigable) to match the design.
  const segments = pathname.startsWith("/read")
    ? pathname
        .replace(/^\/read\/?/, "")
        .split("/")
        .filter(Boolean)
    : [];

  // Help pages live under `/help/<…segments>` and carry a "Help" breadcrumb
  // prefix instead of the Library source — they come from the bundled Help
  // tree, not the user's content source.
  const isHelp = pathname === "/help" || pathname.startsWith("/help/");
  const helpSegments = isHelp
    ? pathname
        .replace(/^\/help\/?/, "")
        .split("/")
        .filter(Boolean)
    : [];

  // Reading settings (width / density / text size / font) only act on the
  // article body (`.prose`), which exists only on document routes. Gating the
  // control here avoids an inert button on the home feed, inbox, search,
  // library, and integrations pages, where there is nothing to restyle.
  const isReadingRoute =
    pathname === "/read" || pathname.startsWith("/read/") || isHelp;

  // The Ask control dispatches ASK_AI_EVENT, which only ChatColumn listens for,
  // and ChatColumn renders nothing unless a real assistant backend is
  // configured. Gate on the same flag so the button never appears inert.
  const assistantEnabled = getAssistantConfig().enabled;

  // Section pages (outside `/read`) carry a static breadcrumb instead of the
  // source-prefixed document path.
  const sectionCrumbs: { label: string; href?: string }[] =
    pathname === "/integrations" || pathname.startsWith("/integrations/")
      ? [{ label: "Integrations" }, { label: "Connect source" }]
      : [];

  const repoCrumbs = source.kind === "github" && source.repo ? source.repo.split("/") : [];

  const docCrumbs = segments.map((seg, i) => ({
    label: seg,
    href: "/read/" + segments.slice(0, i + 1).join("/"),
  }));

  const helpCrumbs = helpSegments.map((seg, i) => ({
    label: seg,
    href: "/help/" + helpSegments.slice(0, i + 1).join("/"),
  }));

  return (
    <header className="app-topbar">
      <button
        type="button"
        className="app-topbar-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <TopBarVault source={source} />

      <nav aria-label="Breadcrumb" className="app-topbar-crumbs">
        {sectionCrumbs.length > 0 ? (
          <>
            <Puzzle className="app-topbar-source-icon" aria-hidden />
            {sectionCrumbs.map((crumb, i) => {
              const isLast = i === sectionCrumbs.length - 1;
              return (
                <Fragment key={crumb.label}>
                  {i > 0 && <span className="app-topbar-sep">/</span>}
                  <span className={`app-topbar-crumb${isLast ? " is-current" : ""}`}>
                    {crumb.label}
                  </span>
                </Fragment>
              );
            })}
          </>
        ) : isHelp ? (
          <>
            <FileText className="app-topbar-source-icon" aria-hidden />
            {helpCrumbs.length === 0 ? (
              <span className="app-topbar-crumb is-current">Help</span>
            ) : (
              <>
                <Link href="/help" className="app-topbar-crumb is-link">
                  Help
                </Link>
                {helpCrumbs.map((crumb, i) => {
                  const isLast = i === helpCrumbs.length - 1;
                  return (
                    <Fragment key={crumb.href}>
                      <span className="app-topbar-sep">/</span>
                      {isLast ? (
                        <span className="app-topbar-crumb is-current">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href} className="app-topbar-crumb is-link">
                          {crumb.label}
                        </Link>
                      )}
                    </Fragment>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <>
            <SourceIcon className="app-topbar-source-icon" aria-hidden />
            {repoCrumbs.map((seg, i) => (
              <Fragment key={"repo:" + i}>
                {i > 0 && <span className="app-topbar-sep">/</span>}
                <span className="app-topbar-crumb">{seg}</span>
              </Fragment>
            ))}
            {docCrumbs.map((crumb, i) => {
              const isLast = i === docCrumbs.length - 1;
              return (
                <Fragment key={crumb.href}>
                  {(repoCrumbs.length > 0 || i > 0) && <span className="app-topbar-sep">/</span>}
                  {isLast ? (
                    <span className="app-topbar-crumb is-current">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="app-topbar-crumb is-link">
                      {crumb.label}
                    </Link>
                  )}
                </Fragment>
              );
            })}
            {docCrumbs.length === 0 && (
              <span className="app-topbar-crumb is-current">{source.name}</span>
            )}
          </>
        )}
      </nav>

      <div className="app-topbar-spacer" />

      <TopBarActions isReadingRoute={isReadingRoute} assistantEnabled={assistantEnabled} />
    </header>
  );
}

/**
 * Right-side action cluster: an inline Cmd-K search pill, the Ask companion
 * trigger (document routes with an assistant configured), and the reading /
 * theme / account controls. Extracted so TopBar itself stays focused on
 * breadcrumb rendering.
 */
function TopBarActions({
  isReadingRoute,
  assistantEnabled,
}: {
  isReadingRoute: boolean;
  assistantEnabled: boolean;
}) {
  return (
    <>
      <Link href="/search" className="app-topbar-cmdk" title="Search (⌘K)">
        <Search className="app-topbar-cmdk-icon" aria-hidden />
        <span className="app-topbar-cmdk-label">Search or jump to a note</span>
        <kbd className="app-topbar-cmdk-kbd">⌘K</kbd>
      </Link>

      {isReadingRoute && (
        <div className="app-topbar-seg" role="group" aria-label="View mode">
          <button type="button" className="app-topbar-seg-btn is-on" aria-pressed="true">
            Read
          </button>
          <button
            type="button"
            className="app-topbar-seg-btn is-soon"
            disabled
            aria-disabled="true"
            title="Editing is coming soon"
          >
            Edit
            <span className="app-topbar-seg-soon">Soon</span>
          </button>
        </div>
      )}

      {isReadingRoute && assistantEnabled && (
        <button
          type="button"
          className="app-topbar-ask"
          onClick={() => window.dispatchEvent(new CustomEvent(ASK_AI_EVENT))}
          aria-label="Ask the reading companion"
        >
          <Sparkles className="app-topbar-ask-icon" aria-hidden />
          <span className="app-topbar-ask-label">Ask</span>
        </button>
      )}

      {isReadingRoute && <ReadingSettings />}
      <ThemeToggle />
      <GitHubLogin />
      <TopBarAccount />
      <UpdateCheck />
    </>
  );
}
