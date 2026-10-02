import type { LibraryDoc } from "@/components/library/LibraryBrowser";
import { importedDocumentHref, type ImportedDocument } from "@/lib/imported-documents";
import { isTauri } from "@/lib/tauri";

export function importedDocumentToLibraryDoc(document: ImportedDocument): LibraryDoc {
  return {
    title: document.title,
    ext: `.${document.format}`,
    href: importedDocumentHref(document.id),
    section: isTauri() ? "Desktop library" : "Browser library",
    tags: [],
    author: document.author,
    updatedISO: document.updatedAt,
    updatedLabel: new Date(document.updatedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    kind: "doc",
  };
}
