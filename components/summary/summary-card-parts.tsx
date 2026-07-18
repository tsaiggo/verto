import { useRef, useState } from "react";
import { Copy, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteSummary,
  findSummary,
  loadSummaries,
  saveSummary,
  type SavedSummary,
  type SummaryDocRef,
} from "@/lib/summaries";
import { formatDate } from "@/lib/format";

function savedLocally(candidate: SavedSummary): boolean {
  const current = findSummary(loadSummaries().summaries, candidate.href);
  return (
    current?.createdAt === candidate.createdAt &&
    current.body === candidate.body &&
    current.model === candidate.model
  );
}

export function SummaryPreview({
  preview,
  doc,
  setPreview,
  copy,
  copied,
  contextNote,
}: {
  preview: { body: string; model: string };
  doc: SummaryDocRef;
  setPreview: (val: { body: string; model: string } | null) => void;
  copy: (text: string) => void;
  copied: boolean;
  contextNote: string;
}) {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  async function persist() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const candidate: SavedSummary = {
      href: doc.href,
      slug: doc.slug,
      title: doc.title,
      body: preview.body,
      model: preview.model,
      contextNote,
      createdAt: new Date().toISOString(),
    };
    let persisted = false;
    try {
      await saveSummary(candidate);
      persisted = true;
    } catch {
      // A desktop portable mirror can reject after the browser cache
      // was updated. Re-read before deciding whether this save failed.
      persisted = savedLocally(candidate);
      if (!persisted) {
        toast.error("Couldn't save summary", {
          description:
            "The generated summary is still here. Check that local storage is available, then retry.",
        });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (persisted) setPreview(null);
  }

  return (
    <>
      <div className="summary-card-body">{preview.body}</div>
      <p className="summary-card-hint">{contextNote}</p>
      <div className="summary-card-actions">
        <button
          type="button"
          className="summary-card-btn"
          onClick={() => void persist()}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="summary-card-btn-subtle" onClick={() => setPreview(null)}>
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
  );
}

export function SummarySaved({
  saved,
  doc,
  regenerate,
  busy,
  token,
  copy,
  copied,
}: {
  saved: SavedSummary;
  doc: SummaryDocRef;
  regenerate: () => void;
  busy: boolean;
  token: string | null;
  copy: (text: string) => void;
  copied: boolean;
}) {
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deleteSummary(doc.href);
    } catch {
      // Portable mirroring can reject after the local deletion has already
      // committed. In that case the global notifier is sufficient.
      if (findSummary(loadSummaries().summaries, doc.href) !== null) {
        toast.error("Couldn't delete summary", {
          description:
            "The summary is still saved. Check that local storage is available, then retry.",
        });
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  function requestRemove() {
    if (deletingRef.current) return;
    if (window.confirm("Delete the saved summary?")) void remove();
  }

  return (
    <>
      <div className="summary-card-body">{saved.body}</div>
      {saved.contextNote ? <p className="summary-card-hint">{saved.contextNote}</p> : null}
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
          onClick={requestRemove}
          disabled={deleting}
          aria-busy={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </>
  );
}

export function SummaryGenerate({
  generate,
  busy,
  token,
  contextNote,
}: {
  generate: () => void;
  busy: boolean;
  token: string | null;
  contextNote: string;
}) {
  return (
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
      <p className="summary-card-hint">{contextNote}</p>
      {!token && (
        <p className="summary-card-hint">Connect the assistant above to generate a summary.</p>
      )}
    </>
  );
}
