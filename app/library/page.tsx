import Link from "next/link";
import { FileText, Filter, ListFilter, MoreVertical, Plus, Search } from "lucide-react";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import PageTabs from "@/components/layout/PageTabs";
import { fileIso, relativeDay } from "@/components/home/home-data";
import { SAMPLE_DOCS, type SampleDoc } from "@/components/pages/sample";

export const metadata = { title: "Library" };

function prettify(segment: string): string {
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toRow(file: ContentFileNode): SampleDoc {
  const leaf = file.slug[file.slug.length - 1] ?? "document";
  return {
    title: file.title,
    file: `${leaf}.md`,
    href: file.href,
    source: file.slug.length > 1 ? prettify(file.slug[0]) : "Overview",
    tags: file.tags ?? [],
    updated: relativeDay(fileIso(file)) || "recently",
    excerpt: file.dek ?? file.description ?? "",
  };
}

export default async function LibraryPage() {
  const files = await listAllFiles();
  const real = files.filter((f) => !f.hidden && !f.draft).map(toRow);
  const rows = real.length > 0 ? real : SAMPLE_DOCS;

  return (
    <>
      <PageHeader title="Library" flush />
      <PageTabs tabs={["All Documents", "Notes", "Drafts", "Images", "Archives"]} />

      <div className="v-page lib">
        <div className="lib-toolbar">
          <label className="lib-search">
            <Search aria-hidden />
            <input type="text" placeholder="Search documents…" />
            <kbd>⌘K</kbd>
          </label>
          <button type="button" className="v-btn v-btn--sm">
            All Sources
          </button>
          <button type="button" className="v-btn v-btn--sm">
            All Tags
          </button>
          <button type="button" className="v-btn v-btn--sm">
            Last updated
          </button>
          <button type="button" className="v-btn v-btn--sm">
            <Filter aria-hidden /> Filter
          </button>
          <button type="button" className="v-btn v-btn--sm lib-view" aria-label="List view">
            <ListFilter aria-hidden />
          </button>
          <Link href="/read" className="v-btn v-btn--primary v-btn--sm lib-new">
            <Plus aria-hidden /> New
          </Link>
        </div>

        <div className="v-card lib-table">
          <div className="lib-head">
            <span className="lib-check" aria-hidden />
            <span>Title</span>
            <span className="lib-col-source">Source</span>
            <span className="lib-col-tags">Tags</span>
            <span className="lib-col-updated">Updated</span>
            <span className="lib-col-menu" aria-hidden />
          </div>

          {rows.map((row, i) => (
            <div className="lib-row" key={`${row.href}-${i}`}>
              <span className="lib-check" aria-hidden />
              <Link href={row.href} className="lib-title">
                <FileText className="lib-title-icon" aria-hidden />
                <span className="lib-title-text">
                  <span className="lib-title-name">{row.file}</span>
                  {row.excerpt && <span className="lib-title-sub">{row.excerpt}</span>}
                </span>
              </Link>
              <span className="lib-col-source lib-source">{row.source}</span>
              <span className="lib-col-tags lib-tags">
                {row.tags.slice(0, 3).map((t) => (
                  <span key={t} className="lib-tag">
                    {t}
                  </span>
                ))}
              </span>
              <span className="lib-col-updated lib-updated">{row.updated}</span>
              <button type="button" className="lib-col-menu lib-menu" aria-label="More actions">
                <MoreVertical aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <div className="lib-foot">
          <span>
            1–{rows.length} of {rows.length} documents
          </span>
          <div className="lib-pager">
            <button type="button" className="v-btn v-btn--sm" disabled>
              Previous
            </button>
            <button type="button" className="lib-page is-active">
              1
            </button>
            <button type="button" className="v-btn v-btn--sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
