"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { hasBrowserLocalFolder } from "@/lib/browser-local-folder";
import {
  addRecentFolder,
  loadRecentFolders,
  saveRecentFolders,
  summarizeInspection,
  type FolderInspection,
  type InspectionSummary,
} from "@/lib/local-folder";
import {
  activateRuntimeLocalFolder,
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  runtimeLocalPickerMode,
  type RuntimeLocalPickerMode,
} from "@/lib/runtime-local-folder";
import {
  activateAndConfirmLocalFolder,
  connectDescription,
  deriveLocalConnectUi,
  inspectionSummary,
} from "./local-source-state";

interface LocalConnectControllerOptions {
  folder: string;
  connectedFolder: string | null;
  onFolderChange: (folder: string) => void;
}

function useLocalConnectModel(onFolderChange: (folder: string) => void) {
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
    setRecent((previous) => {
      const next = addRecentFolder(previous, value);
      saveRecentFolders(next);
      return next;
    });
  }, []);

  const applyConnectedFolder = useCallback(
    (activeFolder: string, inspection: FolderInspection | null) => {
      onFolderChange(activeFolder);
      setSummary(inspectionSummary(inspection, summarizeInspection));
      remember(activeFolder);
    },
    [onFolderChange, remember]
  );

  return {
    applyConnectedFolder,
    connecting,
    operationRef,
    pickerMode,
    picking,
    recent,
    setConnecting,
    setPickerMode,
    setPicking,
    setSummary,
    summary,
  };
}

function useLocalConnectActions(
  folder: string,
  onFolderChange: (folder: string) => void,
  model: ReturnType<typeof useLocalConnectModel>
) {
  async function connect(value: string, fallbackInspection: FolderInspection | null = null) {
    const result = await activateAndConfirmLocalFolder(value, fallbackInspection, {
      activate: activateRuntimeLocalFolder,
      readActive: loadActiveRuntimeLocalFolder,
    });
    model.applyConnectedFolder(result.activeFolder, result.inspection);
  }

  async function onChoose() {
    if (model.operationRef.current) return;
    model.operationRef.current = true;
    model.setPicking(true);
    try {
      const selection = await chooseRuntimeLocalFolder();
      if (!selection) return;
      model.setPickerMode(selection.mode);
      onFolderChange(selection.folder);
      model.setSummary(inspectionSummary(selection.inspection, summarizeInspection));

      if (selection.mode === "browser") {
        await connect(selection.folder, selection.inspection);
        toast.success("Local library connected", {
          description: connectDescription(selection.mode),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not choose or connect the local library", { description: message });
    } finally {
      model.operationRef.current = false;
      model.setPicking(false);
    }
  }

  async function onPickRecent(value: string) {
    if (model.operationRef.current) return;
    model.operationRef.current = true;
    onFolderChange(value);
    model.setSummary(null);
    model.setConnecting(true);
    try {
      await connect(value);
      toast.success("Local library connected", {
        description: connectDescription(model.pickerMode),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Reconnect this library with Choose folder", { description: message });
    } finally {
      model.operationRef.current = false;
      model.setConnecting(false);
    }
  }

  async function onConnect() {
    if (model.operationRef.current) return;
    const candidate = folder.trim();
    if (!candidate) {
      toast.error("Choose a folder first.");
      return;
    }

    model.operationRef.current = true;
    model.setConnecting(true);
    try {
      await connect(candidate);
      toast.success("Local library connected", {
        description: connectDescription(model.pickerMode),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Could not connect this local library", { description: message });
    } finally {
      model.operationRef.current = false;
      model.setConnecting(false);
    }
  }

  return { onChoose, onConnect, onPickRecent };
}

export function useLocalConnectController({
  folder,
  connectedFolder,
  onFolderChange,
}: LocalConnectControllerOptions) {
  const model = useLocalConnectModel(onFolderChange);
  const actions = useLocalConnectActions(folder, onFolderChange, model);
  const hasChosenBrowserFolder = model.pickerMode === "browser" && hasBrowserLocalFolder(folder);
  const ui = deriveLocalConnectUi({
    folder,
    connectedFolder,
    pickerMode: model.pickerMode,
    hasChosenBrowserFolder,
  });

  return { ...model, ...actions, ...ui };
}
