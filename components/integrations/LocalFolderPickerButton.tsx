"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addRecentFolder,
  loadRecentFolders,
  saveActiveLocalFolder,
  saveRecentFolders,
  summarizeInspection,
} from "@/lib/local-folder";
import { chooseRuntimeLocalFolder, runtimeLocalPickerMode } from "@/lib/runtime-local-folder";

interface LocalFolderPickerButtonProps {
  className?: string;
  children?: ReactNode;
}

export default function LocalFolderPickerButton({
  className = "v-btn v-btn--primary v-btn--sm",
  children = "Choose folder",
}: LocalFolderPickerButtonProps) {
  const [picking, setPicking] = useState(false);

  async function onClick() {
    if (runtimeLocalPickerMode() === "unavailable") {
      toast("Folder picking is not available here.", {
        description: "Run the desktop app or a modern browser to connect a local folder.",
      });
      return;
    }

    setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;

      saveActiveLocalFolder(selection.folder);
      saveRecentFolders(addRecentFolder(loadRecentFolders(), selection.folder));
      showConnectedToast(selection);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not open folder picker: ${message}`);
    } finally {
      setPicking(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void onClick()}
      disabled={picking}
      aria-busy={picking}
    >
      {picking ? (
        <>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Choosing...
        </>
      ) : (
        <>
          <FolderOpen aria-hidden className="h-4 w-4" />
          {children}
        </>
      )}
    </button>
  );
}

function showConnectedToast(selection: Awaited<ReturnType<typeof chooseRuntimeLocalFolder>>) {
  if (!selection) return;
  const summary = selection.inspection ? summarizeInspection(selection.inspection) : null;
  const suffix =
    selection.mode === "browser"
      ? "Files are cached in this browser for local preview."
      : "Library and Explorer will refresh automatically.";

  if (!summary) {
    toast.success("Local folder connected", { description: suffix });
    return;
  }

  const description = summary.tone === "ok" ? `${summary.message} ${suffix}` : summary.message;
  if (summary.tone === "ok") {
    toast.success("Local folder connected", { description });
  } else {
    toast.warning("Local folder connected", { description });
  }
}
