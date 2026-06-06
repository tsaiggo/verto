"use client";

// Right-rail document summary card.
//
// Generates a one-shot, Markdown-structured summary of the document the reader
// is viewing and lets them persist it locally — keyed by the document `href` in
// `localStorage` (see `lib/summaries.ts`). Unlike the chat panel, nothing is
// ever saved automatically: the model output is shown as a preview the reader
// can Save, Discard, or Copy, and a saved summary survives reloads without
// re-calling the model.
//
// Credentials follow the same runtime-aware pattern as `AssistantPanel`, which
// owns the connect / disconnect UI:
//
//   • Disabled entirely unless `NEXT_PUBLIC_VERTO_ASSISTANT` is configured.
//   • On the desktop app it reuses the signed-in GitHub token and the Tauri
//     HTTP plugin (to bypass CORS).
//   • In the browser it falls back to the key kept only in localStorage.

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, ScrollText, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTauri, tauriFetch, type FetchLike } from "@/lib/tauri";
import {
  createAssistantProvider,
  getAssistantConfig,
  AssistantError,
} from "@/lib/ai";
import { buildSummaryMessages, readDocContextFromDom } from "@/lib/ai/context";
import { loadWebKey } from "@/lib/ai/key-store";
import {
  findSummary,
  loadSummaries,
  saveSummary,
  deleteSummary,
  type SavedSummary,
  type SummaryDocRef,
} from "@/lib/summaries";
import { formatDate } from "@/lib/format";

export default function SummaryCard({ doc }: { doc: SummaryDocRef }) {
  const config = useMemo(() => getAssistantConfig(), []);
  const { available: desktop, token: desktopToken } = useAuth();

  const [webKey, setWebKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const [preview, setPreview] = useState<{
    body: string;
    model: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate the web fallback key on mount (browser only).
  useEffect(() => {
    if (!isTauri()) setWebKey(loadWebKey());
  }, []);

  // Load the saved summary for this document and keep it in sync with the
  // store's same-tab + cross-tab "storage" notifications.
  useEffect(() => {
    const sync = () =>
      setSaved(findSummary(loadSummaries().summaries, doc.href));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [doc.href]);

  // Disabled at build time — render nothing so the bundle/UI is unaffected.
  if (!config.enabled) return null;

  const token = desktop ? desktopToken : webKey;

  async function generate() {
    if (busy) return;
    const activeToken = desktop ? desktopToken : webKey;
    if (!activeToken) {
      setError("Connect the assistant first.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const fetchImpl: FetchLike = await tauriFetch();
      const provider = createAssistantProvider({
        kind: config.kind,
        token: activeToken,
        model: config.model,
        fetchImpl,
      });
      const ctx = readDocContextFromDom();
      const messages = buildSummaryMessages(ctx);
      const result = await provider.chat(messages, { maxTokens: 700 });
      setPreview({ body: result.content, model: result.model });
    } catch (err) {
      const message =
        err instanceof AssistantError || err instanceof Error
          ? err.message
          : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    if (!window.confirm("Replace the saved summary for this document?")) return;
    void generate();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="rail-panel summary-card" aria-label="Document summary">
      <div className="summary-card-head">
        <ScrollText className="summary-card-icon" aria-hidden />
        <span className="summary-card-title">Summary</span>
      </div>

      {preview ? (
        <>
          <div className="summary-card-body">{preview.body}</div>
          <div className="summary-card-actions">
            <button
              type="button"
              className="summary-card-btn"
              onClick={() => {
                saveSummary({
                  href: doc.href,
                  slug: doc.slug,
                  title: doc.title,
                  body: preview.body,
                  model: preview.model,
                  createdAt: new Date().toISOString(),
                });
                setPreview(null);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="summary-card-btn-subtle"
              onClick={() => setPreview(null)}
            >
              Discard
            </button>
            <button
              type="button"
              className="summary-card-btn-subtle"
              onClick={() => void copy(preview.body)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : saved ? (
        <>
          <div className="summary-card-body">{saved.body}</div>
          <p className="summary-card-meta">
            Generated {formatDate(saved.createdAt)}
            {saved.model ? ` · ${saved.model}` : ""}
          </p>
          <div className="summary-card-actions">
            <button
              type="button"
              className="summary-card-btn"
              onClick={regenerate}
              disabled={busy || !token}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {busy ? "Generating…" : "Regenerate"}
            </button>
            <button
              type="button"
              className="summary-card-btn-subtle"
              onClick={() => void copy(saved.body)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className="summary-card-btn-subtle"
              onClick={() => {
                if (window.confirm("Delete the saved summary?"))
                  deleteSummary(doc.href);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="summary-card-btn"
            onClick={() => void generate()}
            disabled={busy || !token}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {busy ? "Generating…" : "Generate summary"}
          </button>
          {!token && (
            <p className="summary-card-hint">
              Connect the assistant above to generate a summary.
            </p>
          )}
        </>
      )}

      {error && <p className="summary-card-error">{error}</p>}
    </section>
  );
}
