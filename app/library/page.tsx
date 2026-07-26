import LibraryBrowser, {
  type LibraryDoc,
  type LibraryKind,
} from "@/components/library/LibraryBrowser";
import styles from "@/components/library/Library.module.css";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";

export const metadata = {
  title: "Library",
  description: "All your connected sources and documents.",
};

/** Title-case a slug segment (e.g. "ai-agents" -> "Ai Agents"). */
function titleize(segment: string): string {
  return segment
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human "time ago" label from an epoch ms value. */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timestamp(file: ContentFileNode): number | null {
  const explicit = file.updated ?? file.date;
  const parsed = explicit ? Date.parse(explicit) : Number.NaN;
  if (!Number.isNaN(parsed)) return parsed;
  return file.mtime > 0 ? file.mtime : null;
}

function kindOf(file: ContentFileNode): LibraryKind {
  const status = (file.status ?? "").toLowerCase();
  const tags = (file.tags ?? []).map((t) => t.toLowerCase());
  if (file.draft) return "draft";
  if (status === "archived" || tags.includes("archived")) return "archive";
  if (file.cover) return "image";
  if (file.ext === ".md") return "note";
  return "doc";
}

export default async function LibraryPage() {
  const files = await listAllFiles();

  const docs: LibraryDoc[] = files
    .filter((f) => !f.hidden)
    .map((f) => {
      const ts = timestamp(f);
      const section = f.slug.length > 1 ? titleize(f.slug[0]) : "Workspace";
      return {
        title: f.title,
        ext: f.ext,
        href: f.href,
        section,
        tags: f.tags ?? [],
        updatedLabel: ts === null ? "Unknown" : relativeTime(ts),
        updatedISO: new Date(ts ?? 0).toISOString(),
        kind: kindOf(f),
      };
    })
    .sort((a, b) => Date.parse(b.updatedISO) - Date.parse(a.updatedISO));

  return (
    <div className={styles.page}>
      <LibraryBrowser
        docs={docs}
        bundledSectionCount={new Set(docs.map((document) => document.section)).size}
      />
    </div>
  );
}
