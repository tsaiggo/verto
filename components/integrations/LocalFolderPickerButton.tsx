"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { inspectFolder, isTauri, pickFolder } from "@/lib/tauri";
import {
  addRecentFolder,
  loadRecentFolders,
  saveActiveLocalFolder,
  saveRecentFolders,
  summarizeInspection,
} from "@/lib/local-folder";

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
    if (!isTauri()) {
      toast("Folder picking is available in the Verto desktop app.", {
        description: "Run the desktop app to connect a real local folder.",
      });
      return;
    }

    setPicking(true);
    try {
      const folder = await pickFolder();
      if (!folder) return;

      saveActiveLocalFolder(folder);
      saveRecentFolders(addRecentFolder(loadRecentFolders(), folder));

      try {
        const inspection = await inspectFolder(folder);
        const summary = summarizeInspection(inspection);
        const description =
          summary.tone === "ok"
            ? `${summary.message} Library and Explorer will refresh automatically.`
            : summary.message;

        if (summary.tone === "ok") {
          toast.success("Local folder connected", { description });
        } else {
          toast.warning("Local folder connected", { description });
        }
      } catch {
        toast.success("Local folder connected", {
          description: "Library and Explorer will refresh automatically.",
        });
      }
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
