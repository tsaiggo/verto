// Static config + types for the Search view (scopes, icons, source list, time windows).
import { BookOpen, Cloud, Code2, FileText, Folder, Github, HardDrive, Hash } from "lucide-react";
import type { SearchScope } from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";

export type LastUpdated = "any" | "today" | "week" | "month";

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

export const SOURCE_ICON: Record<SourceKind | "googledrive" | "help", typeof Github> = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
  googledrive: HardDrive,
  help: BookOpen,
};

// The source groups shown in the design. The active Library source and the
// always-bundled Help docs are connected; the rest render as disabled
// placeholders so the panel reflects reality without pretending data exists
// behind them.
export const DESIGN_SOURCES: {
  kind: SourceKind | "googledrive" | "help";
  label: string;
  comingSoon?: boolean;
}[] = [
  { kind: "local", label: "Local Files" },
  { kind: "help", label: "Help" },
  { kind: "github", label: "GitHub Repos" },
  { kind: "onedrive", label: "OneDrive" },
  { kind: "googledrive", label: "Google Drive", comingSoon: true },
];

export const WINDOW_MS: Record<Exclude<LastUpdated, "any">, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};
