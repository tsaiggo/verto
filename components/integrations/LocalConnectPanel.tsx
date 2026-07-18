"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { hasBrowserLocalFolder } from "@/lib/browser-local-folder";
import {
  addRecentFolder,
  loadRecentFolders,
  saveRecentFolders,
  sameLocalFolder,
  summarizeInspection,
  type FolderInspection,
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
  const operationRef = useRef(false);

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

  function applyConnectedFolder(activeFolder: string, inspection: FolderInspection | null) {
    onFolderChange(activeFolder);
    setSummary(inspection ? summarizeInspection(inspection) : null);
    remember(activeFolder);
  }

  async function connect(value: string, fallbackInspection: FolderInspection | null = null) {
    const candidate = value.trim();
    let inspection = fallbackInspection;
    try {
      inspection = await activateRuntimeLocalFolder(candidate);
    } catch (error) {
      const activeFolder = loadActiveRuntimeLocalFolder();
      if (!activeFolder || !sameLocalFolder(activeFolder, candidate)) throw error;
      applyConnectedFolder(activeFolder, inspection);
      return;
    }

    const activeFolder = loadActiveRuntimeLocalFolder();
    if (!activeFolder) {
      throw new Error("Verto could not confirm the active local library.");
    }
    if (!sameLocalFolder(activeFolder, candidate)) {
      throw new Error(
        "The active local library changed before this connection finished. Try again."
      );
    }
    applyConnectedFolder(activeFolder, inspection);
  }

  async function onChoose() {
    if (operationRef.current) return;
    operationRef.current = true;
    setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;
      setPickerMode(selection.mode);
      onFolderChange(selection.folder);
      setSummary(selection.inspection ? summarizeInspection(selection.inspection) : null);

      // Browser selection replaces one sandboxed cache, so activate it as the
      // live source immediately. The candidate stays visible if activation
      // genuinely fails, allowing the user to retry without choosing again.
      if (selection.mode === "browser") {
        await connect(selection.folder, selection.inspection);
        toast.success("Local library connected", {
          description: connectDescription(selection.mode),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Could not choose or connect the local library", { description: message });
    } finally {
      operationRef.current = false;
      setPicking(false);
    }
  }

  async function onPickRecent(value: string) {
    if (operationRef.current) return;
    operationRef.current = true;
    onFolderChange(value);
    setSummary(null);
    setConnecting(true);
    try {
      await connect(value);
      toast.success("Local library connected", { description: connectDescription(pickerMode) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Reconnect this library with Choose folder", { description: message });
    } finally {
      operationRef.current = false;
      setConnecting(false);
    }
  }

  async function onConnect() {
    if (operationRef.current) return;
    const trimmed = folder.trim();
    if (!trimmed) {
      toast.error("Choose a folder first.");
      return;
    }

    operationRef.current = true;
    setConnecting(true);
    try {
      await connect(trimmed);
      toast.success("Local library connected", { description: connectDescription(pickerMode) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not connect this local library", { description: message });
    } finally {
      operationRef.current = false;
      setConnecting(false);
    }
  }

  const hasChosenBrowserFolder = pickerMode === "browser" && hasBrowserLocalFolder(folder);
  const candidate = folder.trim();
  const isAlreadyConnected = Boolean(
    candidate && connectedFolder && sameLocalFolder(candidate, connectedFolder)
  );
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
    <section
      className={styles.connectForm}
      aria-label="Local library connection"
      aria-busy={picking || connecting}
    >
      {showTitle ? (
        <h2 className={styles.connectTitle}>
          <FolderOpen aria-hidden /> Local Library
        </h2>
      ) : null}

      <FolderField
        folder={folder}
        pickerMode={pickerMode}
        picking={picking}
        disabled={picking || connecting}
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
