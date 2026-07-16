// Static config + types for the Search view (scopes, icons, time windows).
import { BookOpen, Cloud, Code2, FileText, Folder, HardDrive, Hash } from "lucide-react";
import type { SearchRecord, SearchScope } from "@/lib/search";

export type LastUpdated = "any" | "today" | "week" | "month";
export type SearchSourceStatus = "ready" | "loading" | "error";

export const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "page", label: "Pages" },
  { value: "heading", label: "Headings" },
  { value: "code", label: "Code" },
  { value: "folder", label: "Folders" },
];

export const KIND_ICON = {
  page: FileText,
  heading: Hash,
  code: Code2,
  folder: Folder,
} as const;

export const SOURCE_ICON: Record<SearchRecord["sourceKind"], typeof HardDrive> = {
  local: HardDrive,
  onedrive: Cloud,
  googledrive: Cloud,
  help: BookOpen,
};

export const WINDOW_MS: Record<Exclude<LastUpdated, "any">, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};
