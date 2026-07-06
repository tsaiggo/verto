import { Copy, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { saveSummary, deleteSummary, type SavedSummary, type SummaryDocRef } from "@/lib/summaries";
import { formatDate } from "@/lib/format";

export function SummaryPreview({
  preview,
  doc,
  setPreview,
  copy,
  copied,
}: {
  preview: { body: string; model: string };
  doc: SummaryDocRef;
  setPreview: (val: { body: string; model: string } | null) => void;
  copy: (text: string) => void;
  copied: boolean;
}) {
  return (
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
  return (
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
            if (window.confirm("Delete the saved summary?")) deleteSummary(doc.href);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete
        </button>
      </div>
    </>
  );
}

export function SummaryGenerate({
  generate,
  busy,
  token,
}: {
  generate: () => void;
  busy: boolean;
  token: string | null;
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
      {!token && (
        <p className="summary-card-hint">Connect the assistant above to generate a summary.</p>
      )}
    </>
  );
}
