"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { readLocalFile } from "@/lib/tauri";
import { estimateReadingTime, formatReadingTime } from "@/lib/reading-time";

type LoadState =
  | { status: "ready"; file: string; source: string }
  | { status: "error"; file: string; message: string };

export default function RuntimeLocalReader() {
  const searchParams = useSearchParams();
  const file = searchParams?.get("file") ?? "";
  const title = searchParams?.get("title") ?? titleFromPath(file);
  const ext = searchParams?.get("ext") ?? "";
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    readLocalFile(file)
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

  const viewState = useMemo<LoadState | { status: "loading" } | { status: "missing" }>(
    () => (!file ? { status: "missing" } : state?.file === file ? state : { status: "loading" }),
    [file, state]
  );

  const readingMinutes = useMemo(
    () => (viewState.status === "ready" ? estimateReadingTime(viewState.source) : 0),
    [viewState]
  );

  const eyebrowParts: string[] = [];
  if (file) eyebrowParts.push(file);
  if (viewState.status === "ready") eyebrowParts.push(formatReadingTime(readingMinutes));

  return (
    <>
      <div className="docs-layout">
        <section className="main" aria-label="Runtime document content">
          <article className="content-wrap prose">
            <header className="doc-header">
              <div className="doc-eyebrow">
                <span className="doc-eyebrow-pill">Local file</span>
                {eyebrowParts.map((part, index) => (
                  <Fragment key={part}>
                    {index > 0 && (
                      <span className="doc-eyebrow-dot" aria-hidden>
                        ·
                      </span>
                    )}
                    <span>{part}</span>
                  </Fragment>
                ))}
              </div>
              <h1 className="doc-title">{title}</h1>
            </header>

            {viewState.status === "missing" && <p>No runtime file was selected.</p>}
            {viewState.status === "loading" && (
              <p>
                Loading {title}
                {ext}…
              </p>
            )}
            {viewState.status === "error" && (
              <div className="callout callout-warning">
                <p>Could not open this runtime file.</p>
                <p>{viewState.message}</p>
              </div>
            )}
            {viewState.status === "ready" && (
              <RuntimeDocument source={viewState.source} format={formatFromExt(ext)} />
            )}
          </article>
        </section>
        <aside className="toc-sidebar">
          <div className="rail-panel toc-panel">
            <span className="toc-title">Runtime file</span>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              This document was read from your selected local folder at runtime.
            </p>
            <Link href="/read" className="home-card-link">
              Back to Library
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function formatFromExt(ext: string) {
  return ext.toLowerCase() === ".md" ? "md" : "mdx";
}

function titleFromPath(file: string): string {
  const name = file.split(/[\\/]/).filter(Boolean).at(-1) ?? "Runtime file";
  return name.replace(/\.(mdx?|markdown)$/i, "") || name;
}
