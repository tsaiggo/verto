import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import LibraryBrowser, {
  type LibraryDoc,
  type LibraryKind,
} from "@/components/library/LibraryBrowser";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import { SAMPLE_DOCS, type SampleDoc } from "@/components/pages/sample";

export const metadata = {
  title: "Library",
  description: "All your connected sources and documents.",
};

/** Title-case a slug segment (e.g. "ai-agents" → "Ai Agents"). */
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

function timestamp(file: ContentFileNode): number {
  const explicit = file.updated ?? file.date;
  const parsed = explicit ? Date.parse(explicit) : Number.NaN;
  return Number.isNaN(parsed) ? file.mtime || Date.now() : parsed;
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

/** Map the demo docs (shown when the workspace is empty) into library rows. */
function sampleToLibraryDoc(doc: SampleDoc, index: number): LibraryDoc {
  const dot = doc.file.lastIndexOf(".");
  const ext = dot >= 0 ? doc.file.slice(dot) : ".md";
  const tags = doc.tags.map((t) => t.toLowerCase());
  const kind: LibraryKind = tags.includes("archived")
    ? "archive"
    : doc.updated.includes("m ago") && index === 0
      ? "draft"
      : ext === ".mdx"
        ? "doc"
        : "note";
  // Synthesize a monotonically decreasing timestamp so the pre-sorted samples
  // keep their order and the facets have something stable to work with.
  const ts = Date.now() - index * 3_600_000;
  return {
    title: doc.title,
    ext,
    href: doc.href,
    section: doc.source,
    tags: doc.tags,
    updatedLabel: doc.updated,
    updatedISO: new Date(ts).toISOString(),
    kind,
  };
}

export default async function LibraryPage() {
  const files = await listAllFiles();

  const real: LibraryDoc[] = files
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
        updatedLabel: relativeTime(ts),
        updatedISO: new Date(ts).toISOString(),
        kind: kindOf(f),
      };
    })
    .sort((a, b) => Date.parse(b.updatedISO) - Date.parse(a.updatedISO));

  const docs = real.length > 0 ? real : SAMPLE_DOCS.map(sampleToLibraryDoc);

  return (
    <>
      <PageHeader
        title="Library"
        subtitle="All your connected sources and documents."
        tools={
          <Link href="/editor" className="v-btn v-btn--primary v-btn--sm">
            <Plus aria-hidden /> New
          </Link>
        }
      />
      <LibraryBrowser docs={docs} />
    </>
  );
}
