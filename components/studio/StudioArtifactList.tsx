"use client";

import { FileText, NotebookPen } from "lucide-react";
import type { StudioArtifact } from "@/components/studio/studio-artifacts";
import { formatStudioDate } from "@/components/studio/studio-artifacts";
import styles from "@/components/studio/Studio.module.css";

export function StudioArtifactList({
  artifacts,
  selectedKey,
  onSelect,
}: {
  artifacts: StudioArtifact[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <ul className={styles.artifactList} aria-label="Knowledge cards">
      {artifacts.map((artifact) => (
        <li key={artifact.key} className={styles.artifactRow}>
          <button
            type="button"
            className={styles.artifactButton}
            data-kind={artifact.kind}
            aria-pressed={artifact.key === selectedKey}
            onClick={() => onSelect(artifact.key)}
          >
            <span className={styles.artifactIcon} aria-hidden>
              {artifact.kind === "summary" ? <FileText /> : <NotebookPen />}
            </span>
            <span className={styles.artifactCopy}>
              <span className={styles.artifactMeta}>
                <span>{artifact.kindLabel}</span>
                <time dateTime={artifact.createdAt}>{formatStudioDate(artifact.createdAt)}</time>
              </span>
              <strong>{artifact.title}</strong>
              <span className={styles.artifactPreview}>{artifact.preview}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
