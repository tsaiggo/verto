import type { PendingWritePreview } from "@/components/assistant/pending-write";

export function PendingWriteCard({
  preview,
  onDecision,
}: {
  preview: PendingWritePreview;
  onDecision: (approved: boolean) => void;
}) {
  return (
    <div className="assistant-proposal" role="alertdialog" aria-label="Confirm action">
      <strong className="assistant-proposal-text">{preview.action}</strong>
      {preview.valid ? (
        <div className="assistant-proposal-detail">
          <p>
            <span>Document</span>
            <strong>{preview.targetTitle}</strong>
            <small>{preview.targetHref}</small>
          </p>
          {preview.fields.map((field) => (
            <p key={field.label}>
              <span>{field.label}</span>
              <q>{field.value}</q>
            </p>
          ))}
        </div>
      ) : (
        <p className="assistant-proposal-error">{preview.error}</p>
      )}
      <div className="assistant-proposal-actions">
        {preview.valid && (
          <button type="button" className="assistant-panel-send" onClick={() => onDecision(true)}>
            Approve
          </button>
        )}
        <button type="button" className="assistant-panel-prompt" onClick={() => onDecision(false)}>
          {preview.valid ? "Decline" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
