"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cloud, FileText, HardDrive, Menu } from "lucide-react";
import ProductUtilities from "@/components/layout/ProductUtilities";
import { resolveDocumentTab } from "@/lib/document-tabs";
import type { SourceInfo } from "@/lib/source-info";
import { requestAppNavigation } from "@/lib/app-navigation";

interface VxTopBarProps {
  /**
   * Present only on document / reading routes. When set, the bar renders the
   * source-prefixed breadcrumb and the reading action cluster instead of the
   * plain product-surface controls.
   */
  source?: SourceInfo;
  onOpenNavigation?: () => void;
}

/**
 * The single application top bar, present on every surface. Product surfaces get
 * the global Search pill + theme / overflow controls; document routes (`/read`,
 * `/help`) additionally get a source-prefixed breadcrumb and the reading action
 * cluster. One bar - the buttons change per page.
 */
export default function VxTopBar({ source, onOpenNavigation }: VxTopBarProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const topBarRef = useRef<HTMLElement>(null);

  // Global shell shortcuts mirror the keycaps exposed in the primary rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "n") return;

      const destination = key === "k" ? "/search" : "/editor";
      if (pathname === destination) return;
      e.preventDefault();
      if (!requestAppNavigation()) return;
      router.push(destination);
    };
    const topBar = topBarRef.current;
    window.addEventListener("keydown", onKey);
    topBar?.setAttribute("data-shortcuts-ready", "true");
    return () => {
      window.removeEventListener("keydown", onKey);
      topBar?.removeAttribute("data-shortcuts-ready");
    };
  }, [pathname, router]);

  const { hasEntityHeader, isHelp, isReadingRoute, isRuntime, runtimeTitle } = resolveTopBarRoute(
    pathname,
    searchParams?.toString() ?? ""
  );

  return (
    <header ref={topBarRef} className="vx-topbar">
      {onOpenNavigation ? (
        <button
          type="button"
          className="vx-topbar-menu"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
        >
          <Menu aria-hidden />
        </button>
      ) : null}
      {isRuntime ? (
        <RuntimeCrumbs title={runtimeTitle} />
      ) : isReadingRoute ? (
        <ReadingCrumbs source={source} pathname={pathname} isHelp={isHelp} />
      ) : (
        <ProductCrumbs pathname={pathname} />
      )}

      <div className="vx-topbar-spacer" />

      <TopBarControls reading={isReadingRoute} entityHeader={hasEntityHeader} />
    </header>
  );
}

function resolveTopBarRoute(pathname: string, search: string) {
  const isHelp = pathname === "/help" || pathname.startsWith("/help/");
  const isRuntime = pathname === "/runtime" || pathname.startsWith("/runtime/");
  const isRead = pathname === "/read" || pathname.startsWith("/read/");
  const isReadingRoute = isRead || isHelp || isRuntime;

  return {
    hasEntityHeader: pathname === "/" || pathname.startsWith("/library") || isReadingRoute,
    isHelp,
    isReadingRoute,
    isRuntime,
    runtimeTitle: isRuntime ? resolveDocumentTab(pathname, search)?.title : undefined,
  };
}

function RuntimeCrumbs({ title }: { title?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="vx-crumbs app-topbar-crumbs">
      <HardDrive className="app-topbar-source-icon" aria-hidden />
      <Link href="/library" className="app-topbar-crumb is-link">
        Local library
      </Link>
      {title ? (
        <>
          <span className="app-topbar-sep" aria-hidden>
            /
          </span>
          <span className="app-topbar-crumb is-current">{title}</span>
        </>
      ) : null}
    </nav>
  );
}

const PRODUCT_CONTEXT: Array<{ matches: (pathname: string) => boolean; label: string }> = [
  { matches: (pathname) => pathname === "/", label: "Home" },
  { matches: (pathname) => pathname.startsWith("/inbox"), label: "Inbox" },
  { matches: (pathname) => pathname.startsWith("/library"), label: "Library" },
  { matches: (pathname) => pathname.startsWith("/collections"), label: "Collections" },
  { matches: (pathname) => pathname.startsWith("/bookmarks"), label: "Bookmarks" },
  { matches: (pathname) => pathname.startsWith("/tags"), label: "Tags" },
  { matches: (pathname) => pathname.startsWith("/agent"), label: "Agent" },
  { matches: (pathname) => pathname.startsWith("/studio"), label: "Knowledge Studio" },
  { matches: (pathname) => pathname.startsWith("/integrations"), label: "Sources" },
  { matches: (pathname) => pathname.startsWith("/settings"), label: "Settings" },
  { matches: (pathname) => pathname.startsWith("/search"), label: "Search" },
];

function ProductCrumbs({ pathname }: { pathname: string }) {
  const page = PRODUCT_CONTEXT.find((item) => item.matches(pathname))?.label ?? "Workspace";

  return (
    <nav aria-label="Current location" className="vx-crumbs vx-product-crumbs">
      <span className="vx-workspace-label">Local workspace</span>
      <span className="vx-crumb-sep" aria-hidden>
        /
      </span>
      <span className="vx-crumb is-current">{page}</span>
    </nav>
  );
}

const SOURCE_ICON = {
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
  const repoCrumbs: string[] = [];
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
function TopBarControls({ reading, entityHeader }: { reading: boolean; entityHeader: boolean }) {
  if (reading || entityHeader) return null;
  return <ProductUtilities />;
}
