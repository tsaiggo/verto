"use client";

// Right-rail document summary card.
//
// The summary uses the configured model backend and a manually saved access key.

import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { tauriFetch, type FetchLike } from "@/lib/tauri";
import { createAssistantProvider, getAssistantConfig, AssistantError } from "@/lib/ai";
import { buildSummaryMessages, readDocContextFromDom } from "@/lib/ai/context";
import { loadWebKey } from "@/lib/ai/key-store";
import { findSummary, loadSummaries, type SavedSummary, type SummaryDocRef } from "@/lib/summaries";
import { SummaryPreview, SummarySaved, SummaryGenerate } from "./summary-card-parts";

export default function SummaryCard({ doc }: { doc: SummaryDocRef }) {
  const config = useMemo(() => getAssistantConfig(), []);

  const [webKey, setWebKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const [preview, setPreview] = useState<{
    body: string;
    model: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setWebKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Load the saved summary for this document and keep it in sync with the
  // store's same-tab + cross-tab "storage" notifications.
  useEffect(() => {
    const sync = () => setSaved(findSummary(loadSummaries().summaries, doc.href));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [doc.href]);

  // Disabled at build time — render nothing so the bundle/UI is unaffected.
  if (!config.enabled) return null;

  const token = config.kind === "mock" ? "mock" : webKey;

  async function generate() {
    if (busy) return;
    const activeToken = config.kind === "mock" ? "mock" : webKey;
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
        err instanceof AssistantError || err instanceof Error ? err.message : String(err);
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
        <SummaryPreview
          preview={preview}
          doc={doc}
          setPreview={setPreview}
          copy={copy}
          copied={copied}
        />
      ) : saved ? (
        <SummarySaved
          saved={saved}
          doc={doc}
          regenerate={regenerate}
          busy={busy}
          token={token}
          copy={copy}
          copied={copied}
        />
      ) : (
        <SummaryGenerate generate={generate} busy={busy} token={token} />
      )}

      {error && <p className="summary-card-error">{error}</p>}
    </section>
  );
}
