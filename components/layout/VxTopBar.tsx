"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleDot,
  Cloud,
  FileText,
  Github,
  HardDrive,
  Menu,
  MoreHorizontal,
  MoreVertical,
  Search,
  Share2,
  Upload,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ReadingSettings from "@/components/ui/ReadingSettings";
import type { SourceInfo } from "@/lib/source-info";

interface VxTopBarProps {
  onMenu: () => void;
  /**
   * Present only on document / reading routes. When set, the bar renders the
   * source-prefixed breadcrumb and the reading action cluster instead of the
   * plain product-surface controls.
   */
  source?: SourceInfo;
}

/**
 * The single application top bar, present on every surface. Product surfaces get
 * the global Search pill + theme / overflow controls; document routes (`/read`,
 * `/help`) additionally get a source-prefixed breadcrumb and the reading action
 * cluster. One bar — the buttons change per page.
 */
export default function VxTopBar({ onMenu, source }: VxTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [focusMode, setFocusMode] = useState(false);

  // ⌘K / Ctrl-K opens the Search & Library page from anywhere in the shell.
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

  // Focus mode: toggle a class on <html> to hide sidebars/rails via CSS
  useEffect(() => {
    document.documentElement.classList.toggle("is-focus-mode", focusMode);
  }, [focusMode]);

  const isHelp = pathname === "/help" || pathname.startsWith("/help/");
  const isReadingRoute = pathname === "/read" || pathname.startsWith("/read/") || isHelp;
  const isReaderRoot = pathname === "/read";

  return (
    <header className="vx-topbar">
      <button
        type="button"
        className="vx-topbar-menu"
        aria-label="Open navigation"
        onClick={onMenu}
      >
        <Menu aria-hidden />
      </button>

      {isReadingRoute ? (
        <ReadingCrumbs source={source} pathname={pathname} isHelp={isHelp} />
      ) : (
        <nav aria-label="Breadcrumb" className="vx-crumbs" />
      )}

      <div className="vx-topbar-spacer" />

      <Link href="/search" className="vx-search" title="Search (⌘K)">
        <Search className="vx-search-icon" aria-hidden />
        <span className="vx-search-label">Search Verto</span>
        <kbd className="vx-kbd">⌘ K</kbd>
      </Link>

      <TopBarControls
        reading={isReadingRoute}
        readerRoot={isReaderRoot}
        focusMode={focusMode}
        onFocusToggle={() => setFocusMode((v) => !v)}
      />
    </header>
  );
}

const SOURCE_ICON = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
} as const;

/** Source-prefixed breadcrumb for `/read` and `/help` document routes. */
function ReadingCrumbs({
  source,
  pathname,
  isHelp,
}: {
  source?: SourceInfo;
  pathname: string;
  isHelp: boolean;
}) {
  const segments = (
    isHelp ? pathname.replace(/^\/help\/?/, "") : pathname.replace(/^\/read\/?/, "")
  )
    .split("/")
    .filter(Boolean);
  const basePrefix = isHelp ? "/help/" : "/read/";
  const docCrumbs = segments.map((seg, i) => ({
    label: seg,
    href: basePrefix + segments.slice(0, i + 1).join("/"),
  }));
  const repoCrumbs =
    !isHelp && source?.kind === "github" && source.repo ? source.repo.split("/") : [];
  const SourceIcon = isHelp || !source ? FileText : SOURCE_ICON[source.kind];

  return (
    <nav aria-label="Breadcrumb" className="vx-crumbs app-topbar-crumbs">
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
        <span className="app-topbar-crumb is-current">
          {isHelp ? "Help" : (source?.name ?? "Library")}
        </span>
      )}
    </nav>
  );
}

/** Right-side controls: reading actions on document routes, theme / overflow otherwise. */
function TopBarControls({
  reading,
  readerRoot,
  focusMode,
  onFocusToggle,
}: {
  reading: boolean;
  readerRoot: boolean;
  focusMode: boolean;
  onFocusToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyCurrentUrl = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false)
    );
  };

  if (!reading) {
    return (
      <>
        <ThemeToggle />
        <button type="button" className="vx-iconbtn" aria-label="More">
          <MoreVertical aria-hidden />
        </button>
      </>
    );
  }
  return (
    <>
      {!readerRoot && <ReadingSettings />}
      <button
        type="button"
        className="vx-iconbtn"
        aria-label={focusMode ? "Exit focus mode" : "Focus target"}
        title={focusMode ? "Exit focus mode" : "Focus mode"}
        onClick={onFocusToggle}
      >
        <CircleDot aria-hidden />
      </button>
      <button
        type="button"
        className="vx-iconbtn"
        aria-label="Export document"
        title="Export is available from the editor view"
        disabled
      >
        <Upload aria-hidden />
      </button>
      <button
        type="button"
        className="vx-iconbtn"
        aria-label={copied ? "Copied document link" : "Share document"}
        title={copied ? "Copied" : "Copy document link"}
        onClick={copyCurrentUrl}
      >
        <Share2 aria-hidden />
      </button>
      <button type="button" className="vx-iconbtn" aria-label="More document actions" disabled>
        <MoreHorizontal aria-hidden />
      </button>
    </>
  );
}
