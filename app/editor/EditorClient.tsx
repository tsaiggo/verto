"use client";

import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { Download, Save } from "lucide-react";
import { isTauri, readLocalFile, writeLocalFile } from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string }
  | { kind: "static" }; // static export, no API routes and no Tauri

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ApiEditorResponse {
  source: string;
  id: string;
  title: string;
  ext: string;
}

export interface EditorClientProps {
  slug?: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function downloadMdx(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("slug")?.trim() || undefined;
}

function defaultFilename(slug?: string): string {
  if (!slug) return "untitled.mdx";
  const base = slug.split("/").pop() ?? "untitled";
  return `${base}.mdx`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditorClient({ slug }: EditorClientProps) {
  const [routeSlug, setRouteSlug] = useState<string | undefined>(undefined);
  const activeSlug = slug ?? routeSlug;
  const [source, setSource] = useState("# Untitled\n\n");
  const [fileId, setFileId] = useState<string | null>(null);
  const [filename, setFilename] = useState(() => defaultFilename(activeSlug));
  const [loadState, setLoadState] = useState<LoadState>(
    activeSlug ? { kind: "loading" } : { kind: "ready" }
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<"source" | "preview">("source");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setRouteSlug(slug ? undefined : slugFromLocation());
    });
    return () => cancelAnimationFrame(raf);
  }, [slug]);

  useEffect(() => {
    if (!activeSlug) {
      return; // already initialized as "ready" via useState initial value
    }
    // Capture the narrowed slug so the nested async closure sees string, not
    // string | undefined (TypeScript does not narrow props into async closures).
    const currentSlug: string = activeSlug;
    let cancelled = false;

    async function load(): Promise<void> {
      if (isTauri()) {
        // Desktop path: read directly via Rust command
        const folder = loadActiveLocalFolder();
        if (!folder) {
          if (!cancelled) {
            setLoadState({
              kind: "error",
              message: "No active folder selected. Use Connect Source first.",
            });
          }
          return;
        }
        // Try .mdx first, then .md
        const candidates = [
          folder + "/" + currentSlug + ".mdx",
          folder + "/" + currentSlug + ".md",
        ];
        for (const path of candidates) {
          try {
            const text = await readLocalFile(path);
            if (!cancelled) {
              setSource(text);
              setFileId(path);
              setFilename(path.split(/[/\\]/).pop() ?? defaultFilename(currentSlug));
              setLoadState({ kind: "ready" });
            }
            return;
          } catch {
            // try the next extension
          }
        }
        if (!cancelled) {
          setLoadState({
            kind: "error",
            message: `"${currentSlug}" not found in ${folder}. Editing a new file.`,
          });
          setFilename(defaultFilename(currentSlug));
        }
        return;
      }

      // Web path: call the dev-server API route
      try {
        const res = await fetch(`/api/editor?slug=${encodeURIComponent(currentSlug)}`);
        const ct = res.headers.get("content-type") ?? "";

        if (!ct.includes("application/json")) {
          // Not our route — likely a static export with no server
          if (!cancelled) setLoadState({ kind: "static" });
          return;
        }

        const json = (await res.json()) as { error?: string } & Partial<ApiEditorResponse>;

        if (!res.ok || json.error) {
          if (!cancelled) {
            setLoadState({ kind: "error", message: json.error ?? `Error ${res.status}` });
          }
          return;
        }

        const { source: src, id, ext } = json;
        if (src !== undefined && id !== undefined && ext !== undefined) {
          if (!cancelled) {
            setSource(src);
            setFileId(id);
            setFilename(`${currentSlug.split("/").pop() ?? "untitled"}${ext}`);
            setLoadState({ kind: "ready" });
          }
        } else if (!cancelled) {
          setLoadState({ kind: "error", message: "Unexpected API response." });
        }
      } catch {
        // Network error — static export or dev server not running
        if (!cancelled) setLoadState({ kind: "static" });
      }
    }

    load().catch((err: unknown) => {
      if (!cancelled) {
        setLoadState({ kind: "error", message: String(err) });
      }
    });

    return () => {
      cancelled = true;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [activeSlug]);

  async function handleSave(): Promise<void> {
    setSaveStatus("saving");
    setSaveError("");

    if (isTauri()) {
      const path =
        fileId ??
        (() => {
          const folder = loadActiveLocalFolder();
          return folder ? `${folder}/${filename}` : null;
        })();

      if (!path) {
        setSaveStatus("error");
        setSaveError("No active folder. Use Connect Source to select a folder first.");
        return;
      }

      try {
        await writeLocalFile(path, source);
        if (!fileId) setFileId(path);
        setSaveStatus("saved");
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err: unknown) {
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    // Web: download
    downloadMdx(filename, source);
    setSaveStatus("idle");
  }

  // Static export with no server and no desktop
  if (loadState.kind === "static") {
    return (
      <div className="ed-static-notice">
        <p>The editor requires the development server or the Verto desktop app.</p>
        <p>
          Run <code>npm run dev</code> locally, or open Verto as a desktop app to edit files.
        </p>
      </div>
    );
  }

  const isDesktop = isTauri();
  const canSave = loadState.kind !== "loading" && saveStatus !== "saving";

  return (
    <div className="ed-client">
      {/* Toolbar */}
      <div className="ed-client-bar">
        <div className="ed-client-tabs">
          <button
            type="button"
            className={`ed-ctab${tab === "source" ? " is-active" : ""}`}
            onClick={() => setTab("source")}
          >
            Source
          </button>
          <button
            type="button"
            className={`ed-ctab${tab === "preview" ? " is-active" : ""}`}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>

        {fileId === null && (
          <input
            className="ed-filename-input"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="filename.mdx"
            aria-label="Filename"
          />
        )}

        <div className="ed-client-actions">
          {saveStatus === "error" && saveError && (
            <span className="ed-save-error" role="alert">
              {saveError}
            </span>
          )}
          <button
            type="button"
            className="v-btn v-btn--sm"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {isDesktop ? (
              <>
                <Save aria-hidden />
                {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save"}
              </>
            ) : (
              <>
                <Download aria-hidden />
                Download .mdx
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {loadState.kind === "loading" && <p className="ed-client-status">Loading…</p>}
      {loadState.kind === "error" && (
        <p className="ed-client-status ed-client-status--warn">{loadState.message}</p>
      )}

      {/* Editor / preview pane */}
      <div className="ed-client-pane">
        {tab === "source" ? (
          <textarea
            className="ed-source-textarea"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            aria-label="MDX source"
            readOnly={loadState.kind === "loading"}
          />
        ) : (
          <div className="ed-preview-pane">
            <Markdown>{source}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
