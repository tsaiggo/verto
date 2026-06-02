"use client";

import Link from "next/link";
import { Fragment, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Cloud,
  Github,
  HardDrive,
  Menu,
  Puzzle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ReadingSettings from "@/components/ui/ReadingSettings";
import UpdateCheck from "@/components/desktop/UpdateCheck";
import GitHubLogin from "@/components/auth/GitHubLogin";
import type { SourceInfo } from "@/lib/source-info";

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
 * Sticky top bar of the main region. Shows a source-prefixed breadcrumb of
 * the current document, a "Previewing from source" status, a Sync action,
 * and the reading / theme / search controls.
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
    ? pathname.replace(/^\/read\/?/, "").split("/").filter(Boolean)
    : [];

  // Section pages (outside `/read`) carry a static breadcrumb instead of the
  // source-prefixed document path.
  const sectionCrumbs: { label: string; href?: string }[] =
    pathname === "/integrations" || pathname.startsWith("/integrations/")
      ? [
          { label: "Integrations" },
          { label: "Connect source" },
        ]
      : [];

  const repoCrumbs =
    source.kind === "github" && source.repo ? source.repo.split("/") : [];

  const docCrumbs = segments.map((seg, i) => ({
    label: seg,
    href: "/read/" + segments.slice(0, i + 1).join("/"),
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

      <nav aria-label="Breadcrumb" className="app-topbar-crumbs">
        {sectionCrumbs.length > 0 ? (
          <>
            <Puzzle className="app-topbar-source-icon" aria-hidden />
            {sectionCrumbs.map((crumb, i) => {
              const isLast = i === sectionCrumbs.length - 1;
              return (
                <Fragment key={crumb.label}>
                  {i > 0 && <span className="app-topbar-sep">/</span>}
                  <span
                    className={`app-topbar-crumb${isLast ? " is-current" : ""}`}
                  >
                    {crumb.label}
                  </span>
                </Fragment>
              );
            })}
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
                  {(repoCrumbs.length > 0 || i > 0) && (
                    <span className="app-topbar-sep">/</span>
                  )}
                  {isLast ? (
                    <span className="app-topbar-crumb is-current">
                      {crumb.label}
                      <ChevronDown
                        className="app-topbar-crumb-chevron"
                        aria-hidden
                      />
                    </span>
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

      <span className="app-topbar-status">
        <span className="app-topbar-status-dot" aria-hidden />
        Previewing from source
      </span>

      <button
        type="button"
        className="app-topbar-sync"
        onClick={() =>
          toast("Up to date", {
            description: "Verto renders content at build time.",
          })
        }
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Sync
      </button>

      <ReadingSettings />
      <ThemeToggle />
      <Button
        asChild
        variant="outline"
        size="icon"
        aria-label="Search"
        title="Search (⌘K)"
        className="app-topbar-search"
      >
        <Link href="/search">
          <Search className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <GitHubLogin />
      <UpdateCheck />
    </header>
  );
}
