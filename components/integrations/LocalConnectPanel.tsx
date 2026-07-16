"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { hasBrowserLocalFolder } from "@/lib/browser-local-folder";
import {
  addRecentFolder,
  loadRecentFolders,
  saveRecentFolders,
  summarizeInspection,
  type InspectionSummary,
} from "@/lib/local-folder";
import {
  chooseRuntimeLocalFolder,
  activateRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  runtimeLocalPickerMode,
  type RuntimeLocalPickerMode,
} from "@/lib/runtime-local-folder";
import { Button } from "@/components/ui/button";
import { FileFilterField, FolderField, RecentFoldersField } from "./local-connect-parts";
import styles from "./Sources.module.css";

interface LocalConnectPanelProps {
  /** Candidate folder path controlled by the parent view. */
  folder: string;
  /** Folder that currently drives the runtime Library. */
  connectedFolder?: string | null;
  /** Update the candidate folder path. */
  onFolderChange: (folder: string) => void;
  /** Hide the repeated heading when embedded in a larger source panel. */
  showTitle?: boolean;
}

export default function LocalConnectPanel({
  folder,
  connectedFolder = null,
  onFolderChange,
  showTitle = true,
}: LocalConnectPanelProps) {
  const [picking, setPicking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [summary, setSummary] = useState<InspectionSummary | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<RuntimeLocalPickerMode>("unavailable");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRecent(loadRecentFolders());
      setPickerMode(runtimeLocalPickerMode());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const remember = useCallback((value: string) => {
    setRecent((prev) => {
      const next = addRecentFolder(prev, value);
      saveRecentFolders(next);
      return next;
    });
  }, []);

  async function onChoose() {
    setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;
      setPickerMode(selection.mode);
      // The browser picker writes one sandboxed cache. Leaving an older folder
      // active after replacing that cache would make its Library appear empty,
      // so the browser action is explicitly labelled and completed as one
      // choose-and-connect operation. Desktop selection can remain a reviewable
      // candidate because native authorization does not replace file data.
      if (selection.mode === "browser") {
        await connect(selection.folder);
        toast.success("Local library connected", {
          description: connectDescription(selection.mode),
        });
        return;
      }
      onFolderChange(selection.folder);
      setSummary(selection.inspection ? summarizeInspection(selection.inspection) : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Could not choose or connect the local library", { description: message });
    } finally {
      setPicking(false);
    }
  }

  async function connect(value: string) {
    const inspection = await activateRuntimeLocalFolder(value);
    const activeFolder = loadActiveRuntimeLocalFolder() ?? value;
    onFolderChange(activeFolder);
    setSummary(summarizeInspection(inspection));
    remember(activeFolder);
    return inspection;
  }

  async function onPickRecent(value: string) {
    setConnecting(true);
    try {
      await connect(value);
      toast.success("Local library connected", { description: connectDescription(pickerMode) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Reconnect this library with Choose folder", { description: message });
    } finally {
      setConnecting(false);
    }
  }

  async function onConnect() {
    const trimmed = folder.trim();
    if (!trimmed) {
      toast.error("Choose a folder first.");
      return;
    }

    setConnecting(true);
    try {
      await connect(trimmed);
      toast.success("Local library connected", { description: connectDescription(pickerMode) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not connect this local library", { description: message });
    } finally {
      setConnecting(false);
    }
  }

  const hasChosenBrowserFolder = pickerMode === "browser" && hasBrowserLocalFolder(folder);
  const candidate = folder.trim();
  const isAlreadyConnected = Boolean(candidate && connectedFolder && candidate === connectedFolder);
  const canConnect =
    candidate !== "" && !isAlreadyConnected && (pickerMode === "desktop" || hasChosenBrowserFolder);
  const connectHint =
    pickerMode === "unavailable"
      ? "Folder selection is unavailable here. Open Verto desktop or a browser with folder access."
      : !candidate
        ? "Choose a folder to review before connecting it."
        : isAlreadyConnected
          ? "This folder is already connected."
          : pickerMode === "browser" && !hasChosenBrowserFolder
            ? "Choose this folder again so the browser can access its files."
            : "Connecting replaces the live Library without deleting either folder.";

  return (
    <section className={styles.connectForm} aria-label="Local library connection">
      {showTitle ? (
        <h2 className={styles.connectTitle}>
          <FolderOpen aria-hidden /> Local Library
        </h2>
      ) : null}

      <FolderField
        folder={folder}
        pickerMode={pickerMode}
        picking={picking}
        summary={summary}
        onFolderChange={onFolderChange}
        setSummary={setSummary}
        onChoose={onChoose}
      />

      <RecentFoldersField
        recent={recent}
        disabled={connecting || picking}
        onPickRecent={onPickRecent}
      />

      <FileFilterField />

      <div className={styles.connectActions}>
        <Button
          type="button"
          size="sm"
          onClick={() => void onConnect()}
          disabled={!canConnect || connecting || picking}
          aria-busy={connecting}
        >
          <Check aria-hidden />
          {connecting ? "Connecting..." : isAlreadyConnected ? "Connected" : "Connect library"}
        </Button>
        <p className={styles.connectHint}>{connectHint}</p>
      </div>
    </section>
  );
}

function connectDescription(mode: RuntimeLocalPickerMode): string {
  if (mode === "desktop") return "Library and Explorer now read from this folder.";
  if (mode === "browser") return "Library and Explorer now use the cached browser selection.";
  return "The local Library is ready.";
}
