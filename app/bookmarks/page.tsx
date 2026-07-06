import Link from "next/link";
import { FileText } from "lucide-react";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";
import { fileIso, relativeDay } from "@/components/home/home-data";
import { SAMPLE_DOCS } from "@/components/pages/sample";

export const metadata = { title: "Bookmarks" };

interface BookmarkRow {
  title: string;
  path: string;
  workspace: string;
  updated: string;
  href: string;
}

function toBookmark(file: ContentFileNode): BookmarkRow {
  return {
    title: file.title,
    path: `${file.slug.join("/")}.md`,
    workspace: file.slug.length > 1 ? `workspace/${file.slug[0]}` : "workspace",
    updated: relativeDay(fileIso(file)) || "recently",
    href: file.href,
  };
}

export default async function BookmarksPage() {
  const files = await listAllFiles();
  const real = files
    .filter((f) => !f.hidden && !f.draft)
    .slice(0, 8)
    .map(toBookmark);

  const rows: BookmarkRow[] =
    real.length > 0
      ? real
      : SAMPLE_DOCS.slice(0, 6).map((d) => ({
          title: d.title,
          path: `docs/${d.file}`,
          workspace: `workspace/${d.tags[0] ?? "core"}`,
          updated: d.updated,
          href: d.href,
        }));

  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Quick access to important documents." flush />
      <PageTabs tabs={["All", "Documents", "Cards", "Collections"]} />

      <div className="v-page">
        <ul className="bm-list">
          {rows.map((row, i) => (
            <li key={`${row.href}-${i}`}>
              <Link href={row.href} className="bm-row">
                <FileText className="bm-icon" aria-hidden />
                <span className="bm-main">
                  <span className="bm-title">{row.title}</span>
                  <span className="bm-path">{row.path}</span>
                </span>
                <span className="bm-workspace">{row.workspace}</span>
                <span className="bm-time">{row.updated}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
