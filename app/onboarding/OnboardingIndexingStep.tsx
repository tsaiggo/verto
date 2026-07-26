"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, FileSearch, FolderOpen } from "lucide-react";
import type { RawFileEntry } from "@/lib/content-source";
import { listRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import { Navigation, StepSurface, useFolderSnapshot } from "./OnboardingShared";
import styles from "./Onboarding.module.css";

interface IndexResult {
  status: "idle" | "loading" | "ready" | "error";
  folder: string | null;
  files: number;
  folders: number;
  samples: string[];
  message?: string;
}

const EMPTY_INDEX: IndexResult = {
  status: "idle",
  folder: null,
  files: 0,
  folders: 0,
  samples: [],
};

function countFolders(entries: RawFileEntry[]): number {
  const folders = new Set<string>();
  for (const entry of entries) {
    for (let depth = 1; depth < entry.path.length; depth += 1) {
      folders.add(entry.path.slice(0, depth).join("/"));
    }
  }
  return folders.size;
}

export default function OnboardingIndexingStep() {
  const folder = useFolderSnapshot();
  const [result, setResult] = useState<IndexResult>(EMPTY_INDEX);

  useEffect(() => {
    if (!folder.readable) return;

    let cancelled = false;
    const activeFolder = folder.readable;

    void listRuntimeLocalFolder(activeFolder)
      .then((entries) => {
        if (cancelled) return;
        setResult({
          status: "ready",
          folder: activeFolder,
          files: entries.length,
          folders: countFolders(entries),
          samples: entries.slice(0, 5).map((entry) => entry.path.join("/")),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          ...EMPTY_INDEX,
          status: "error",
          folder: activeFolder,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [folder.readable]);

  const visibleResult: IndexResult = !folder.readable
    ? EMPTY_INDEX
    : result.folder === folder.readable
      ? result
      : { ...EMPTY_INDEX, status: "loading", folder: folder.readable };

  const indexCopy = useMemo(() => {
    if (!folder.remembered) {
      return {
        icon: <FolderOpen />,
        title: "No personal folder selected",
        description:
          "That is okay. Continue with the included demo, or go back and choose a folder.",
      };
    }
    if (!folder.readable || visibleResult.status === "error") {
      return {
        icon: <CircleAlert />,
        title: "Folder access needs attention",
        description:
          "Your files were not changed. Choose the folder again to restore access, or continue with the included demo.",
      };
    }
    if (visibleResult.status === "loading") {
      return {
        icon: <FileSearch />,
        title: "Reading file names and headings",
        description:
          "Verto is building a local index for Library and Search. Files stay in place while this runs.",
      };
    }
    return {
      icon: <CircleCheck />,
      title:
        visibleResult.files === 0 ? "The folder is readable but empty" : "Local index is ready",
      description:
        visibleResult.files === 0
          ? "No .md or .mdx files were found. You can add files later or choose another folder."
          : "Library and Search can now use the Markdown files in this folder.",
    };
  }, [folder.readable, folder.remembered, visibleResult.files, visibleResult.status]);

  return (
    <>
      <StepSurface
        icon={<FileSearch />}
        title="Check what Verto can read"
        description="This scan is local and read-only. It verifies file access before you enter the workspace."
      >
        <div
          className={styles.indexState}
          role={visibleResult.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <div className={styles.indexHead}>
            {indexCopy.icon}
            <div>
              <strong>{indexCopy.title}</strong>
              <p>{indexCopy.description}</p>
            </div>
          </div>
          {visibleResult.status === "loading" ? (
            <div
              className={styles.progress}
              role="progressbar"
              aria-label="Indexing Markdown files"
            />
          ) : null}
        </div>

        {visibleResult.status === "ready" ? (
          <>
            <div className={styles.indexMetrics}>
              <span className={styles.indexMetric}>
                <strong>Readable files</strong>
                <span>{visibleResult.files.toLocaleString()}</span>
              </span>
              <span className={styles.indexMetric}>
                <strong>Folders</strong>
                <span>{visibleResult.folders.toLocaleString()}</span>
              </span>
            </div>
            {visibleResult.samples.length > 0 ? (
              <ul className={styles.sampleList} aria-label="Indexed file sample">
                {visibleResult.samples.map((sample) => (
                  <li key={sample}>{sample}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {visibleResult.status === "error" && visibleResult.message ? (
          <p className={styles.bodyCopy}>System detail: {visibleResult.message}</p>
        ) : null}
      </StepSurface>
      <Navigation
        previous="source"
        next={{ step: "ai", label: "Continue" }}
        skip={
          visibleResult.status === "error" || visibleResult.status === "idle"
            ? { href: "/onboarding/ai", label: "Skip indexing" }
            : undefined
        }
      />
    </>
  );
}
