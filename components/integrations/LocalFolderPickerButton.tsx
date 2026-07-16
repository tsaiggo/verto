"use client";

import { useState, type ReactNode } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useHasMounted } from "@/components/ui/use-has-mounted";
import {
  addRecentFolder,
  loadRecentFolders,
  saveRecentFolders,
  summarizeInspection,
} from "@/lib/local-folder";
import {
  activateRuntimeLocalFolder,
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  runtimeLocalPickerMode,
  type RuntimeLocalFolderSelection,
} from "@/lib/runtime-local-folder";

interface LocalFolderPickerButtonProps {
  className?: string;
  children?: ReactNode;
  onConnected?: (folder: string) => void;
}

export default function LocalFolderPickerButton({
  className = "v-btn v-btn--primary v-btn--sm",
  children = "Choose folder",
  onConnected,
}: LocalFolderPickerButtonProps) {
  const [picking, setPicking] = useState(false);
  const hasMounted = useHasMounted();
  const pickerMode = hasMounted ? runtimeLocalPickerMode() : null;

  // The picker depends on browser/Tauri APIs, so determine support only after
  // hydration. A disabled form already explains the limitation below; hiding
  // this header shortcut avoids advertising an action that cannot succeed.
  if (pickerMode === "unavailable") return null;

  async function onClick() {
    setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;

      const inspection = await activateRuntimeLocalFolder(selection.folder);
      const connected: RuntimeLocalFolderSelection = {
        ...selection,
        folder: loadActiveRuntimeLocalFolder() ?? selection.folder,
        inspection,
      };
      saveRecentFolders(addRecentFolder(loadRecentFolders(), connected.folder));
      onConnected?.(connected.folder);
      showConnectedToast(connected);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Could not connect the local library", { description: message });
    } finally {
      setPicking(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void onClick()}
      disabled={picking || pickerMode === null}
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

function showConnectedToast(selection: RuntimeLocalFolderSelection | null) {
  if (!selection) return;
  const summary = selection.inspection ? summarizeInspection(selection.inspection) : null;
  const suffix =
    selection.mode === "browser"
      ? "Files are cached in this browser for local preview."
      : "Library and Explorer will refresh automatically.";

  if (!summary) {
    toast.success("Local library connected", { description: suffix });
    return;
  }

  const description = summary.tone === "ok" ? `${summary.message} ${suffix}` : summary.message;
  if (summary.tone === "ok") {
    toast.success("Local library connected", { description });
  } else {
    toast.warning("Local library connected", { description });
  }
}
