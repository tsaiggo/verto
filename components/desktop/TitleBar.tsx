"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { isTauri } from "@/lib/tauri";

// The custom title bar replaces the native Windows caption, which is too
// short compared to integrated title bars in apps like Windows Terminal or
// Edge. We only take it over on Windows (where native decorations are
// disabled via `tauri.windows.conf.json`); macOS / Linux keep their native
// decorations and the bar stays hidden.
function isWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Windows/i.test(navigator.userAgent);
}

type WindowAction = "minimize" | "maximize" | "close";

/**
 * Taller, client-drawn title bar for the Windows desktop build.
 *
 * Renders nothing in the web build or on non-Windows desktops. When active it
 * provides a draggable region (so the window can be moved / double-click
 * maximized) plus the minimize, maximize/restore and close controls, and it
 * toggles the `has-titlebar` class so the shell reserves space below it.
 */
export default function TitleBar() {
  const [enabled, setEnabled] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri() || !isWindows()) return;

    setEnabled(true);
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
  }, []);

  const run = useCallback(async (action: WindowAction) => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (action === "minimize") await win.minimize();
    else if (action === "maximize") await win.toggleMaximize();
    else await win.close();
  }, []);

  if (!enabled) return null;

  return (
    <div className="tauri-titlebar" data-tauri-drag-region>
      <div className="tauri-titlebar-brand" data-tauri-drag-region>
        <span className="tauri-titlebar-logo" aria-hidden>
          <svg viewBox="0 0 24 24" width={14} height={14}>
            <path d="M4 4l8 16 8-16H4z" fill="currentColor" />
          </svg>
        </span>
        <span className="tauri-titlebar-title">Verto</span>
      </div>

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
    </div>
  );
}
