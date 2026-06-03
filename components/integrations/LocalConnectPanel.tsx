"use client";

// Live "open a local folder" panel.
//
// Rendered inside ConnectSourceView when the "Local Files" provider is
// selected. On the desktop build it opens the operating system's native folder
// picker so the user can choose any directory of `.mdx` / `.md` files to read.
// In the browser build there is no filesystem access, so the picker button is
// disabled and the field falls back to a plain, editable path.
//
// Verto renders content at build time, so the chosen folder is surfaced (and is
// the value the user would set via `VERTO_LOCAL_DIR`) rather than swapped in
// live — `onSave` explains how to apply it, mirroring the other providers.

import { useState } from "react";
import { Check, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isTauri, pickFolder } from "@/lib/tauri";
import { DEFAULT_FILE_FILTER } from "@/lib/connection-info";
import { Button } from "@/components/ui/button";

interface LocalConnectPanelProps {
  /** Currently chosen folder path (controlled by the parent view). */
  folder: string;
  /** Update the chosen folder path. */
  onFolderChange: (folder: string) => void;
}

export default function LocalConnectPanel({
  folder,
  onFolderChange,
}: LocalConnectPanelProps) {
  const [picking, setPicking] = useState(false);
  const desktop = isTauri();

  async function onChoose() {
    setPicking(true);
    try {
      const chosen = await pickFolder();
      if (chosen) onFolderChange(chosen);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not open folder picker: ${message}`);
    } finally {
      setPicking(false);
    }
  }

  function onSave() {
    if (!folder.trim()) {
      toast.error("Choose a folder to open first.");
      return;
    }
    toast("Local source is configured at build time", {
      description:
        "Set VERTO_CONTENT_SOURCE=local and VERTO_LOCAL_DIR to this folder, then rebuild to read it.",
    });
  }

  return (
    <section className="connect-form" aria-label="Local folder connection">
      <h2 className="connect-form-title">
        <FolderOpen className="h-4 w-4" aria-hidden /> Local Files
      </h2>

      <div className="connect-field">
        <label className="connect-field-label" htmlFor="local-folder">
          Folder
        </label>
        <div className="connect-field-control">
          <div className="connect-folder-row">
            <input
              id="local-folder"
              className="connect-input"
              value={folder}
              placeholder={desktop ? "No folder chosen" : "/path/to/content"}
              spellCheck={false}
              onChange={(e) => onFolderChange(e.target.value)}
            />
            <button
              type="button"
              className="connect-folder-choose"
              onClick={() => void onChoose()}
              disabled={!desktop || picking}
            >
              {picking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FolderOpen className="h-4 w-4" aria-hidden />
              )}
              Choose folder…
            </button>
          </div>
          <p className="connect-field-help">
            {desktop
              ? "Pick a folder of .mdx / .md files on this device to open."
              : "Folder picking is available in the Verto desktop app. Enter a path manually here."}
          </p>
        </div>
      </div>

      <div className="connect-field">
        <span className="connect-field-label">File filter</span>
        <div className="connect-field-control">
          <div className="connect-input-wrap">
            <input
              className="connect-input"
              defaultValue={DEFAULT_FILE_FILTER}
              readOnly
              aria-readonly
              spellCheck={false}
            />
          </div>
          <p className="connect-field-help">
            Only files matching this pattern are read. Supports .mdx and .md
            only.
          </p>
        </div>
      </div>

      <div className="connect-form-actions">
        <Button type="button" onClick={onSave}>
          <Check className="h-4 w-4" aria-hidden />
          Save &amp; connect
        </Button>
      </div>
    </section>
  );
}
