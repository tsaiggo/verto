"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import DocumentTabs from "@/components/layout/DocumentTabs";
import ChatColumn from "@/components/reader/ChatColumn";
import ReaderFrame from "@/components/reader/ReaderFrame";
import ArticleTocCard from "@/components/reader/ArticleTocCard";
import CopyPageButton from "@/components/reader/CopyPageButton";
import { BookmarkButton } from "@/components/reader/BookmarkButton";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import ReadingSettings from "@/components/ui/ReadingSettings";
import { readRuntimeLocalFile } from "@/lib/runtime-local-folder";
import { estimateReadingTime, formatReadingTime } from "@/lib/reading-time";
import { runtimeFileLabel, stripRuntimeTitleHeading } from "@/lib/runtime-reader-source";
import { extractTOC } from "@/lib/toc";

const RUNTIME_LOCAL_SLUG_PREFIX = "runtime-local";

type LoadState =
  | { status: "ready"; file: string; source: string }
  | { status: "error"; file: string; message: string };
type RuntimeViewState = LoadState | { status: "loading" } | { status: "missing" };

export default function RuntimeLocalReader() {
  const searchParams = useSearchParams();
  const file = searchParams?.get("file") ?? "";
  const title = searchParams?.get("title") ?? titleFromPath(file);
  const ext = searchParams?.get("ext") ?? "";
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    readRuntimeLocalFile(file)
      .then((source) => {
        if (!cancelled) setState({ status: "ready", file, source });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            file,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const viewState = useMemo<RuntimeViewState>(
    () => (!file ? { status: "missing" } : state?.file === file ? state : { status: "loading" }),
    [file, state]
  );

  const readingMinutes = useMemo(
    () => (viewState.status === "ready" ? estimateReadingTime(viewState.source) : 0),
    [viewState]
  );

  const toc = useMemo(
    () => (viewState.status === "ready" ? extractTOC(viewState.source) : []),
    [viewState]
  );

  const runtimeHref = useMemo(() => runtimeLocalHref(file, title, ext), [ext, file, title]);
  const runtimeSlug = useMemo(() => [RUNTIME_LOCAL_SLUG_PREFIX, file || title], [file, title]);
  const hasContextPanel = viewState.status === "ready" && toc.length > 0;

  return (
    <div className={`docs-layout read-layout${file ? "" : " reader-no-tabs"}`}>
      <ReaderFrame
        mainLabel="Runtime document content"
        tabs={file ? <DocumentTabs /> : undefined}
        context={
          hasContextPanel ? (
            <>
              <ArticleTocCard items={toc} title={title} />
              <Link href="/library" className="home-card-link">
                Back to Library
              </Link>
            </>
          ) : undefined
        }
        contextProps={hasContextPanel ? { "aria-label": "Document navigation" } : undefined}
        chat={<ChatColumn doc={{ href: runtimeHref, slug: runtimeSlug, title }} />}
      >
        <RuntimeMasthead
          file={file}
          fileLabel={runtimeFileLabel(file, title, ext)}
          href={runtimeHref}
          readingMinutes={viewState.status === "ready" ? readingMinutes : null}
          title={title}
        />
        <article className="content-wrap prose" data-article>
          <RuntimeArticleBody
            ext={ext}
            file={file}
            href={runtimeHref}
            slug={runtimeSlug}
            state={viewState}
            title={title}
          />
        </article>
      </ReaderFrame>
    </div>
  );
}

function RuntimeArticleBody({
  ext,
  file,
  href,
  slug,
  state,
  title,
}: {
  ext: string;
  file: string;
  href: string;
  slug: string[];
  state: RuntimeViewState;
  title: string;
}) {
  if (state.status === "missing") {
    return (
      <div className="runtime-reader-state">
        <h2>Choose a document from your Library</h2>
        <p>Local Markdown and MDX files open here in the full reading workspace.</p>
        <Link href="/library" className="runtime-reader-state-link">
          Open Library
        </Link>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="runtime-reader-state" aria-live="polite">
        <h2>Opening {title}</h2>
        <p>Loading the selected local file…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="runtime-reader-state runtime-reader-state--error" role="alert">
        <h2>Could not open this local file</h2>
        <p>{state.message}</p>
        <Link href="/library" className="runtime-reader-state-link">
          Return to Library
        </Link>
      </div>
    );
  }

  return (
    <>
      <ReadingStateTracker
        href={href}
        slug={slug}
        title={title}
        path={runtimePathLabel(file, title, ext)}
      />
      <RuntimeDocument
        source={stripRuntimeTitleHeading(state.source)}
        format={formatFromExt(ext || file)}
      />
      <AnnotationsLayer
        docSlug={slug.join("/")}
        share={{ title, author: "Local file", tags: [], href }}
      />
    </>
  );
}

function RuntimeMasthead({
  file,
  fileLabel,
  href,
  readingMinutes,
  title,
}: {
  file: string;
  fileLabel: string;
  href: string;
  readingMinutes: number | null;
  title: string;
}) {
  return (
    <header className="doc-header" data-page-identity>
      <div className="doc-identity">
        <span className="doc-identity-icon" aria-hidden>
          <FileText />
        </span>
        <div className="doc-identity-copy">
          <div className="doc-title-row">
            <h1 className="doc-title">{file ? title : "Local reader"}</h1>
          </div>
          <div className="doc-eyebrow">
            <span className="doc-eyebrow-pill">Local library</span>
            {file ? <span>{fileLabel}</span> : <span>No document selected</span>}
            {readingMinutes !== null ? (
              <>
                <span className="doc-eyebrow-dot" aria-hidden>
                  ·
                </span>
                <span>{formatReadingTime(readingMinutes)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {file ? (
        <CopyPageButton>
          <BookmarkButton href={href} title={title} kind="document" />
          <AddToCollectionButton href={href} title={title} mobileSheet />
          <ReadingSettings />
        </CopyPageButton>
      ) : null}
    </header>
  );
}

function runtimeLocalHref(file: string, title: string, ext: string): string {
  if (!file) return "/runtime/local";
  const params = new URLSearchParams({ file, title, ext });
  return `/runtime/local?${params.toString()}`;
}

function runtimePathLabel(file: string, title: string, ext: string): string {
  if (file) return file;
  return `${title}${ext}`;
}

function formatFromExt(extOrPath: string) {
  return extOrPath.toLowerCase().endsWith(".md") ? "md" : "mdx";
}

function titleFromPath(file: string): string {
  const name = file.split(/[\\/]/).filter(Boolean).at(-1) ?? "Runtime file";
  return name.replace(/\.(mdx?|markdown)$/i, "") || name;
}
