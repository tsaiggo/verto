"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  FilePenLine,
  Folder,
  FolderOpen,
  Menu,
  MoreHorizontal,
  PanelRight,
  Search,
  Settings2,
} from "lucide-react";
import type { SourceInfo } from "@/lib/source-info";
import { APP_NEW_DOCUMENT_EVENT, requestAppNavigation } from "@/lib/app-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnvironmentPanel } from "@/components/state/EnvironmentPanelState";

interface VxTopBarProps {
  source?: SourceInfo;
  onOpenNavigation?: () => void;
}

const ROUTE_TITLES: Array<{ matches: (pathname: string) => boolean; label: string }> = [
  { matches: (pathname) => pathname === "/", label: "Explore your library" },
  { matches: (pathname) => pathname.startsWith("/inbox"), label: "Reading inbox" },
  { matches: (pathname) => pathname.startsWith("/library"), label: "Library" },
  { matches: (pathname) => pathname.startsWith("/collections"), label: "Collections" },
  { matches: (pathname) => pathname.startsWith("/bookmarks"), label: "Bookmarks" },
  { matches: (pathname) => pathname.startsWith("/tags"), label: "Tags" },
  { matches: (pathname) => pathname.startsWith("/agent"), label: "Agent" },
  { matches: (pathname) => pathname.startsWith("/studio"), label: "Knowledge Studio" },
  { matches: (pathname) => pathname.startsWith("/integrations"), label: "Sources" },
  { matches: (pathname) => pathname.startsWith("/settings"), label: "Settings" },
  { matches: (pathname) => pathname.startsWith("/search"), label: "Search" },
  { matches: (pathname) => pathname.startsWith("/editor"), label: "New document" },
];

function titleize(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  return decoded.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function routeTitle(pathname: string): string {
  const known = ROUTE_TITLES.find((item) => item.matches(pathname));
  if (known) return known.label;
  const segment = pathname.split("/").filter(Boolean).at(-1);
  return segment ? titleize(segment) : "Verto";
}

export default function VxTopBar({ source, onOpenNavigation }: VxTopBarProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const topBarRef = useRef<HTMLElement>(null);
  const title = routeTitle(pathname);
  const environmentPanel = useEnvironmentPanel();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key !== "k" && key !== "n") return;

      const destination = key === "k" ? "/search" : "/editor";
      event.preventDefault();
      if (pathname === destination) {
        if (key === "n") window.dispatchEvent(new Event(APP_NEW_DOCUMENT_EVENT));
        return;
      }
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

  return (
    <header ref={topBarRef} className="vx-topbar codex-task-bar">
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

      <div className="codex-task-identity">
        <Folder aria-hidden />
        <span title={title}>{title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="codex-task-more" aria-label="Task actions">
              <MoreHorizontal aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={7}>
            <DropdownMenuItem asChild>
              <Link href="/search">
                <Search aria-hidden /> Search library
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings2 aria-hidden /> Workspace settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="vx-topbar-spacer" />

      <div className="codex-task-tools">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="codex-open-in" aria-label="Open destination menu">
              <FolderOpen aria-hidden />
              <span>Open in</span>
              <ChevronDown aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={7}>
            <DropdownMenuItem asChild>
              <Link href="/library">
                <BookOpen aria-hidden /> Library
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/editor">
                <FilePenLine aria-hidden /> Editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/integrations">
                <FolderOpen aria-hidden /> {source?.name ?? "Sources"}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {pathname === "/" && environmentPanel ? (
          <button
            type="button"
            className="codex-task-tool"
            aria-label={environmentPanel.open ? "Hide environment" : "Show environment"}
            aria-pressed={environmentPanel.open}
            data-environment-toggle
            onClick={environmentPanel.toggle}
          >
            <PanelRight aria-hidden />
          </button>
        ) : (
          <Link href="/settings/appearance" className="codex-task-tool" aria-label="View options">
            <Settings2 aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
