"use client";

// Live "open a local folder" panel.
//
// Rendered inside source-management surfaces. On the desktop build it opens the
// operating system's native folder picker so the user can choose any directory
// of `.mdx` / `.md` files to read, then scans that folder and reports how many
// readable files it holds. In the browser it uses the browser folder/file picker
// and caches readable files locally so the Library flow can be debugged without
// launching the desktop shell.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { hasBrowserLocalFolder } from "@/lib/browser-local-folder";
import { inspectFolder } from "@/lib/tauri";
import {
  addRecentFolder,
  loadRecentFolders,
  saveActiveLocalFolder,
  saveRecentFolders,
  summarizeInspection,
  type InspectionSummary,
} from "@/lib/local-folder";
import {
  chooseRuntimeLocalFolder,
  runtimeLocalPickerMode,
  type RuntimeLocalPickerMode,
} from "@/lib/runtime-local-folder";
import { Button } from "@/components/ui/button";
import { FolderField, RecentFoldersField, FileFilterField } from "./local-connect-parts";

interface LocalConnectPanelProps {
  /** Currently chosen folder path (controlled by the parent view). */
  folder: string;
  /** Update the chosen folder path. */
  onFolderChange: (folder: string) => void;
  /** Hide the repeated heading when the panel is embedded in a larger source card. */
  showTitle?: boolean;
}

export default function LocalConnectPanel({
  folder,
  onFolderChange,
  showTitle = true,
}: LocalConnectPanelProps) {
  const [picking, setPicking] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<RuntimeLocalPickerMode>("unavailable");

  // Guards against a slow inspection of an earlier folder overwriting the
  // result for a folder the user has since changed to.
  const inspectSeq = useRef(0);

  useEffect(() => {
    setRecent(loadRecentFolders());
    setPickerMode(runtimeLocalPickerMode());
  }, []);

  const remember = useCallback((value: string) => {
    setRecent((prev) => {
      const next = addRecentFolder(prev, value);
      saveRecentFolders(next);
      return next;
    });
  }, []);

  // Typed paths can be inspected only in the desktop shell. Browser previews
  // must come from the picker because a plain path string grants no file access.
  const inspect = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (pickerMode !== "desktop" || !trimmed) {
        setSummary(null);
        return;
      }
      const seq = ++inspectSeq.current;
      setInspecting(true);
      try {
        const result = await inspectFolder(trimmed);
        if (seq === inspectSeq.current) setSummary(summarizeInspection(result));
      } catch {
        if (seq === inspectSeq.current) setSummary(null);
      } finally {
        if (seq === inspectSeq.current) setInspecting(false);
      }
    },
    [pickerMode]
  );

  async function onChoose() {
    setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;
      setPickerMode(selection.mode);
      onFolderChange(selection.folder);
      remember(selection.folder);
      saveActiveLocalFolder(selection.folder);
      setSummary(selection.inspection ? summarizeInspection(selection.inspection) : null);
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
    saveActiveLocalFolder(value);
    void inspect(value);
  }

  function onSave() {
    const trimmed = folder.trim();
    if (!trimmed) {
      toast.error("Choose a folder to open first.");
      return;
    }
    if (pickerMode === "browser" && !hasBrowserLocalFolder(trimmed)) {
      toast.error("Use Choose folder to load files in the browser.", {
        description: "Browsers cannot read a typed local path without the picker.",
      });
      return;
    }
    remember(trimmed);
    saveActiveLocalFolder(trimmed);
    toast("Local source connected", { description: saveDescription(pickerMode) });
  }

  return (
    <section className="connect-form" aria-label="Local folder connection">
      {showTitle && (
        <h2 className="connect-form-title">
          <FolderOpen className="h-4 w-4" aria-hidden /> Local Files
        </h2>
      )}

      <FolderField
        folder={folder}
        pickerMode={pickerMode}
        picking={picking}
        inspecting={inspecting}
        summary={summary}
        onFolderChange={onFolderChange}
        setSummary={setSummary}
        inspect={inspect}
        onChoose={onChoose}
      />

      <RecentFoldersField recent={recent} onPickRecent={onPickRecent} />

      <FileFilterField />

      <div className="connect-form-actions">
        <Button type="button" onClick={onSave}>
          <Check className="h-4 w-4" aria-hidden />
          Save &amp; connect
        </Button>
      </div>
    </section>
  );
}

function saveDescription(mode: RuntimeLocalPickerMode): string {
  if (mode === "desktop") return "The Library rail will refresh with files from this folder.";
  if (mode === "browser") return "The browser preview will refresh with cached files.";
  return "Set VERTO_CONTENT_SOURCE=local and VERTO_LOCAL_DIR to read it during a build.";
}
