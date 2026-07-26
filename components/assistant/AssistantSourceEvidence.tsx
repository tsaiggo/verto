"use client";

import type { AssistantSourceCitation } from "@/components/assistant/source-citations";

export function AssistantSourceEvidence({
  citations,
  invalidCitationCount = 0,
  onSelect,
}: {
  citations: AssistantSourceCitation[];
  invalidCitationCount?: number;
  onSelect: (citation: AssistantSourceCitation) => void;
}) {
  if (citations.length === 0) {
    return (
      <p className="assistant-panel-hint" role="status">
        No supporting passage was found on the current page.
      </p>
    );
  }

  return (
    <div aria-label="Current page evidence">
      <p className="assistant-panel-hint">Evidence from this page</p>
      <ul className="assistant-steps">
        {citations.map((citation) => (
          <li key={citation.id} className="assistant-step">
            <a
              className="assistant-panel-link"
              href={`#${encodeURIComponent(citation.targetId)}`}
              aria-label={`Go to ${citation.label}`}
              onClick={(event) => {
                event.preventDefault();
                onSelect(citation);
              }}
            >
              [{citation.index}] {citation.label}
            </a>
          </li>
        ))}
      </ul>
      {invalidCitationCount > 0 ? (
        <p className="assistant-panel-hint" role="status">
          Some source references could not be verified against the current page.
        </p>
      ) : null}
    </div>
  );
}
