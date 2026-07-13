export type RuntimeSourceHeaderState =
  | { status: "idle" }
  | { status: "loading"; folder: string }
  | { status: "ready"; folder: string; index: RuntimeSourceHeaderIndex }
  | { status: "error"; folder: string };

interface RuntimeSourceHeaderIndex {
  documents: readonly unknown[];
  libraryDocs: readonly { section: string }[];
}

export interface BundledSourceCounts {
  documents: number;
  sections: number;
}

export interface RuntimeSourceHeaderSummary {
  mode: "bundled" | "local-loading" | "local-ready" | "local-error";
  sourceLabel: string;
  sourceTitle?: string;
  documentCount: number | null;
  sectionCount: number | null;
  documentLabel: string;
  sectionLabel: string;
}

function quantityLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function runtimeFolderName(folder: string): string {
  const trimmed = folder.trim();
  if (!trimmed) return "Local library";

  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/, "");
  if (!withoutTrailingSeparators) return trimmed.startsWith("/") ? "/" : trimmed;

  return withoutTrailingSeparators.split(/[\\/]/).at(-1) || withoutTrailingSeparators;
}

/**
 * Resolve honest page-header metadata for the source currently driving a
 * runtime-aware surface. Counts never fall back to the bundled demo while a
 * selected local folder is still loading or has failed to open.
 */
export function resolveRuntimeSourceHeader(
  runtime: RuntimeSourceHeaderState,
  bundled: BundledSourceCounts
): RuntimeSourceHeaderSummary {
  if (runtime.status === "idle") {
    return {
      mode: "bundled",
      sourceLabel: "Included demo",
      documentCount: bundled.documents,
      sectionCount: bundled.sections,
      documentLabel: quantityLabel(bundled.documents, "document"),
      sectionLabel: quantityLabel(bundled.sections, "section"),
    };
  }

  const sourceLabel = `Folder · ${runtimeFolderName(runtime.folder)}`;
  if (runtime.status === "loading") {
    return {
      mode: "local-loading",
      sourceLabel,
      sourceTitle: runtime.folder,
      documentCount: null,
      sectionCount: null,
      documentLabel: "Counting documents…",
      sectionLabel: "Discovering sections…",
    };
  }

  if (runtime.status === "error") {
    return {
      mode: "local-error",
      sourceLabel,
      sourceTitle: runtime.folder,
      documentCount: null,
      sectionCount: null,
      documentLabel: "Document count unavailable",
      sectionLabel: "Section count unavailable",
    };
  }

  const documentCount = runtime.index.documents.length;
  const sectionCount = new Set(
    runtime.index.libraryDocs.map((document) => document.section.trim()).filter(Boolean)
  ).size;

  return {
    mode: "local-ready",
    sourceLabel,
    sourceTitle: runtime.folder,
    documentCount,
    sectionCount,
    documentLabel: quantityLabel(documentCount, "document"),
    sectionLabel: quantityLabel(sectionCount, "section"),
  };
}
