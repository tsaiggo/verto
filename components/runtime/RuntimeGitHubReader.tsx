"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReadingProgress from "@/components/reader/ReadingProgress";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { useAuth } from "@/components/auth/AuthProvider";
import { createGitHubSourceFromConnection } from "@/lib/content-source/github";
import { estimateReadingTime, formatReadingTime } from "@/lib/reading-time";
import { loadRuntimeGitHubFile } from "@/lib/runtime-github-cache";
import { tauriFetch } from "@/lib/tauri";

type LoadState =
  | { status: "ready"; file: string; connectionKey: string; source: string }
  | { status: "error"; file: string; connectionKey: string; message: string };

type ViewState = LoadState | { status: "loading" } | { status: "missing" };

export default function RuntimeGitHubReader() {
  const searchParams = useSearchParams();
  const file = searchParams.get("file") ?? "";
  const title = searchParams.get("title") ?? "Runtime GitHub file";
  const ext = searchParams.get("ext") ?? "";
  const auth = useAuth();
  const connectionKey = auth.connection
    ? `${auth.connection.repo}\n${auth.connection.branch}\n${auth.connection.path}`
    : null;
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file || !auth.token || !auth.connection || !connectionKey) return;

    const accessToken = auth.token;
    const activeConnection = auth.connection;
    const activeKey = connectionKey;

    async function load() {
      try {
        const fetchImpl = await tauriFetch();
        const source = createGitHubSourceFromConnection(
          { ...activeConnection, token: accessToken },
          { fetchImpl }
        );
        const text = await loadRuntimeGitHubFile(
          {
            repo: activeConnection.repo,
            branch: activeConnection.branch,
            path: activeConnection.path,
            file,
          },
          () => source.readFile({ id: file })
        );
        if (!cancelled) {
          setState({
            status: "ready",
            file,
            connectionKey: activeKey,
            source: text,
          });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setState({
            status: "error",
            file,
            connectionKey: activeKey,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.connection, auth.token, connectionKey, file]);

  const viewState = useMemo<ViewState>(() => {
    if (!file) return { status: "missing" };
    if (auth.loading) return { status: "loading" };
    if (!auth.token || !auth.connection || !connectionKey) {
      return {
        status: "error",
        file,
        connectionKey: "",
        message: "Sign in and connect a GitHub repository to open this file.",
      };
    }
    if (state?.file === file && state.connectionKey === connectionKey) {
      return state;
    }
    return { status: "loading" };
  }, [auth.connection, auth.loading, auth.token, connectionKey, file, state]);

  const readingMinutes = useMemo(
    () => (viewState.status === "ready" ? estimateReadingTime(viewState.source) : 0),
    [viewState]
  );

  return (
    <>
      <ReadingProgress />
      <div className="docs-layout">
        <section className="main" aria-label="Runtime document content">
          <article className="content-wrap prose">
            <header className="doc-header">
              <span className="doc-category" aria-label="Source">
                Runtime GitHub file
              </span>
              <h1 className="doc-title">{title}</h1>
              <div className="doc-meta doc-meta-fallback">
                <span>{auth.connection?.repo ?? "GitHub repository"}</span>
                {auth.connection && <span>{auth.connection.branch}</span>}
                {viewState.status === "ready" && <span>{formatReadingTime(readingMinutes)}</span>}
              </div>
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
                <p>Could not open this GitHub file.</p>
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
              This document was read from your connected GitHub repository at runtime.
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
