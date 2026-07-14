import { Copy, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { saveSummary, deleteSummary, type SavedSummary, type SummaryDocRef } from "@/lib/summaries";
import { formatDate } from "@/lib/format";

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
  return (
    <>
      <div className="summary-card-body">{preview.body}</div>
      <p className="summary-card-hint">{contextNote}</p>
      <div className="summary-card-actions">
        <button
          type="button"
          className="summary-card-btn"
          onClick={async () => {
            try {
              await saveSummary({
                href: doc.href,
                slug: doc.slug,
                title: doc.title,
                body: preview.body,
                model: preview.model,
                contextNote,
                createdAt: new Date().toISOString(),
              });
              setPreview(null);
            } catch {
              // The global StateStore notifier explains why the preview could
              // not be made portable; keep it visible so it can be retried.
            }
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
          onClick={() => {
            if (window.confirm("Delete the saved summary?")) {
              void deleteSummary(doc.href).catch(() => {});
            }
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
