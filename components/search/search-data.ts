// Static config + types for the Search view (scopes, icons, source list, time windows).
import { BookOpen, Code2, FileText, Folder, HardDrive, Hash } from "lucide-react";
import type { SearchScope } from "@/lib/search";

export type LastUpdated = "any" | "today" | "week" | "month";
export type SearchFilterSourceKind = "local" | "help";

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

export const SOURCE_ICON: Record<SearchFilterSourceKind, typeof HardDrive> = {
  local: HardDrive,
  help: BookOpen,
};

// Library search currently indexes local Markdown/MDX documents and the
// bundled Help docs. RSS items live in Inbox and are managed as subscriptions.
export const DESIGN_SOURCES: {
  kind: SearchFilterSourceKind;
  label: string;
}[] = [
  { kind: "local", label: "Local Files" },
  { kind: "help", label: "Help" },
];

export const WINDOW_MS: Record<Exclude<LastUpdated, "any">, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};
