"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Home,
  LibraryBig,
  Minus,
  Plus,
  Square,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isTauri } from "@/lib/tauri";

// The shared desktop chrome carries history and workspace tabs on every
// desktop platform. Windows also renders its window controls here because
// native decorations are disabled via `tauri.windows.conf.json`; macOS keeps
// native traffic lights over the draggable leading area.
function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Windows/i.test(navigator.userAgent);
}

function subscribePlatform(): () => void {
  return () => {};
}

function windowsPlatformSnapshot(): boolean {
  return isTauri() && isWindows();
}

type WindowAction = "minimize" | "maximize" | "close";

interface WorkspaceTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

function titleize(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  const spaced = decoded.replace(/[-_]+/g, " ").trim();
  return spaced ? spaced.replace(/\b\w/g, (character) => character.toUpperCase()) : "Document";
}

function currentWorkspaceTab(pathname: string): WorkspaceTab {
  if (pathname === "/") return { href: "/", label: "Home", icon: Home };
  if (pathname.startsWith("/library")) {
    return { href: "/library", label: "Library", icon: LibraryBig };
  }
  if (pathname.startsWith("/read/")) {
    return {
      href: pathname,
      label: titleize(pathname.split("/").filter(Boolean).at(-1) ?? "Document"),
      icon: FileText,
    };
  }

  const segment = pathname.split("/").filter(Boolean)[0] ?? "Home";
  return { href: pathname, label: titleize(segment), icon: FileText };
}

/**
 * Shared desktop chrome with real route tabs and browser history controls.
 * The full bar is draggable in Tauri; Windows adds minimize, maximize and
 * close controls while macOS overlays its native traffic lights.
 */
export default function TitleBar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const windowsControlsEnabled = useSyncExternalStore(
    subscribePlatform,
    windowsPlatformSnapshot,
    () => false
  );
  const [maximized, setMaximized] = useState(false);

  useLayoutEffect(() => {
    if (!windowsControlsEnabled) return;
    document.documentElement.classList.add("has-titlebar");

    let active = true;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const sync = async () => {
        try {
          setMaximized(await win.isMaximized());
        } catch {
          /* window not ready yet — ignore */
        }
      };
      await sync();
      const stop = await win.onResized(() => {
        void sync();
      });
      if (active) {
        unlisten = stop;
      } else {
        stop();
      }
    })();

    return () => {
      active = false;
      unlisten?.();
      document.documentElement.classList.remove("has-titlebar");
    };
  }, [windowsControlsEnabled]);

  const run = useCallback(async (action: WindowAction) => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    else if (action === "maximize") await win.toggleMaximize();
    else await win.close();
  }, []);

  const current = currentWorkspaceTab(pathname);
  const companion: WorkspaceTab = pathname.startsWith("/library")
    ? { href: "/", label: "Home", icon: Home }
    : { href: "/library", label: "Library", icon: LibraryBig };
  const CurrentIcon = current.icon;
  const CompanionIcon = companion.icon;

  return (
    <div
      className={`tauri-titlebar vx-desktop-chrome${windowsControlsEnabled ? " is-windows" : ""}`}
      data-tauri-drag-region
    >
      <div className="vx-desktop-history" data-tauri-drag-region>
        <button type="button" aria-label="Go back" onClick={() => router.back()}>
          <ChevronLeft aria-hidden />
        </button>
        <button type="button" aria-label="Go forward" onClick={() => window.history.forward()}>
          <ChevronRight aria-hidden />
        </button>
      </div>

      <nav className="vx-desktop-tabs" aria-label="Workspace tabs">
        <Link href={current.href} className="vx-desktop-tab is-active" aria-current="page">
          <CurrentIcon aria-hidden />
          <span>{current.label}</span>
        </Link>
        {companion.href !== current.href && (
          <Link href={companion.href} className="vx-desktop-tab">
            <CompanionIcon aria-hidden />
            <span>{companion.label}</span>
          </Link>
        )}
        <Link href="/editor" className="vx-desktop-tab-add" aria-label="New document">
          <Plus aria-hidden />
        </Link>
      </nav>

      <div className="vx-desktop-drag" data-tauri-drag-region />

      {windowsControlsEnabled && (
        <div className="tauri-titlebar-controls">
          <button
            type="button"
            className="tauri-titlebar-btn"
            aria-label="Minimize"
            onClick={() => run("minimize")}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className="tauri-titlebar-btn"
            aria-label={maximized ? "Restore" : "Maximize"}
            onClick={() => run("maximize")}
          >
            {maximized ? (
              <Copy className="h-3 w-3" aria-hidden />
            ) : (
              <Square className="h-3 w-3" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="tauri-titlebar-btn tauri-titlebar-btn-close"
            aria-label="Close"
            onClick={() => run("close")}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
