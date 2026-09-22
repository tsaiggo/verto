"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Compass, Home, LibraryBig, Search, Settings, FolderInput, Bell, Inbox, Tag, Bookmark, Bot, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

export interface GenericPanelProps {
  routeLabel?: string;
  onCollapse?: () => void;
}

/* TODO(ws-shell-2): per-route panel — replace GenericPanel with dedicated panels */
const SIBLINGS: Array<{ label: string; href: string; icon: typeof Home }> = [
  { label: "Home", href: "/", icon: Home },
  { label: "Library", href: "/library", icon: LibraryBig },
  { label: "Recent", href: "/recent", icon: Bell },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Collections", href: "/collections", icon: Layers },
  { label: "Tags", href: "/tags", icon: Tag },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Search", href: "/search", icon: Search },
  { label: "Sources", href: "/integrations", icon: FolderInput },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help", href: "/help", icon: Compass },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/read");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function GenericPanel({ routeLabel, onCollapse }: GenericPanelProps) {
  const pathname = usePathname() ?? "/";

  return (
    <div className={wsStyles.genericPanel} data-testid="workspace-generic-panel">
      <header className={wsStyles.genericHeader}>
        <strong>{routeLabel ?? "Workspace"}</strong>
        {onCollapse ? (
          <button type="button" className={wsStyles.genericCollapse} aria-label="Collapse sidebar" onClick={onCollapse}>
            <PanelLeft aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <nav className={wsStyles.genericNav} aria-label="Section navigation">
        {SIBLINGS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(wsStyles.genericLink, active && wsStyles.genericLinkActive)}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
        <div className={wsStyles.genericTodo} role="note">
          {/* TODO(ws-shell-2): per-route panel */} Temporary panel — will be replaced by dedicated per-route panels in phase 2.
          <br />
          <code>components/shell/panels/registry.tsx</code>
        </div>
      </nav>
    </div>
  );
}
