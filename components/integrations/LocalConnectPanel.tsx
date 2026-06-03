"use client";

// Live "open a local folder" panel.
//
// Rendered inside ConnectSourceView when the "Local Files" provider is
// selected. On the desktop build it opens the operating system's native folder
// picker so the user can choose any directory of `.mdx` / `.md` files to read,
// then scans that folder and reports how many readable files it holds so the
// choice produces real feedback instead of silently doing nothing. Folders are
// remembered (in `localStorage`) and offered for one-click re-opening.
//
// In the browser build there is no filesystem access, so the picker button is
// disabled, the field falls back to a plain editable path, and live inspection
// is unavailable (remembered folders still work).
//
// Verto renders content at build time, so the chosen folder is surfaced (and is
// the value the user would set via `VERTO_LOCAL_DIR`) rather than swapped in
// live — `onSave` explains how to apply it, mirroring the other providers.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Clock,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { inspectFolder, isTauri, pickFolder } from "@/lib/tauri";
import { DEFAULT_FILE_FILTER } from "@/lib/connection-info";
import {
  addRecentFolder,
  loadRecentFolders,
  saveRecentFolders,
  summarizeInspection,
  type InspectionSummary,
} from "@/lib/local-folder";
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
  const [inspecting, setInspecting] = useState(false);
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const desktop = isTauri();

  // Guards against a slow inspection of an earlier folder overwriting the
  // result for a folder the user has since changed to.
  const inspectSeq = useRef(0);

  useEffect(() => {
    setRecent(loadRecentFolders());
  }, []);

  const remember = useCallback((value: string) => {
    setRecent((prev) => {
      const next = addRecentFolder(prev, value);
      saveRecentFolders(next);
      return next;
    });
  }, []);

  // Scan a folder (desktop only) and surface how many readable files it holds.
  const inspect = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!desktop || !trimmed) {
        setSummary(null);
        return;
      }
      const seq = ++inspectSeq.current;
      setInspecting(true);
      try {
        const result = await inspectFolder(trimmed);
        if (seq === inspectSeq.current) setSummary(summarizeInspection(result));
      } catch {
        // A failed scan should never block the flow; just clear the hint.
        if (seq === inspectSeq.current) setSummary(null);
      } finally {
        if (seq === inspectSeq.current) setInspecting(false);
      }
    },
    [desktop],
  );

  async function onChoose() {
    setPicking(true);
    try {
      const chosen = await pickFolder();
      if (chosen) {
        onFolderChange(chosen);
        void inspect(chosen);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not open folder picker: ${message}`);
    } finally {
      setPicking(false);
    }
  }

  function onPickRecent(value: string) {
    onFolderChange(value);
    remember(value);
    void inspect(value);
  }

  function onSave() {
    const trimmed = folder.trim();
    if (!trimmed) {
      toast.error("Choose a folder to open first.");
      return;
    }
    remember(trimmed);
    toast("Local source is configured at build time", {
      description: `Set VERTO_CONTENT_SOURCE=local and VERTO_LOCAL_DIR=${trimmed}, then rebuild to read it.`,
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
              onChange={(e) => {
                onFolderChange(e.target.value);
                setSummary(null);
              }}
              onBlur={(e) => void inspect(e.target.value)}
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
          {desktop && (inspecting || summary) ? (
            <p
              className={`connect-folder-status is-${
                inspecting ? "checking" : summary!.tone
              }`}
              role="status"
            >
              {inspecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Checking folder…
                </>
              ) : summary!.tone === "ok" ? (
                <>
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                  {summary!.message}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {summary!.message}
                </>
              )}
            </p>
          ) : (
            <p className="connect-field-help">
              {desktop
                ? "Pick a folder of .mdx / .md files on this device to open."
                : "Folder picking is available in the Verto desktop app. Enter a path manually here."}
            </p>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="connect-field">
          <span className="connect-field-label">Recent folders</span>
          <div className="connect-field-control">
            <ul className="connect-recent-list">
              {recent.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    className="connect-recent-item"
                    onClick={() => onPickRecent(value)}
                    title={value}
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    <span className="connect-recent-path">{value}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="connect-field-help">
              Folders you have opened on this device. Click one to re-open it.
            </p>
          </div>
        </div>
      )}

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
