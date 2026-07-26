"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssistantSourceCitation } from "@/components/assistant/source-citations";
import {
  assistantCitationIndexFromHref,
  assistantCitationTargetHref,
} from "@/components/assistant/source-citations";

export function AssistantAnswerMarkdown({
  content,
  citations,
  onSelect,
}: {
  content: string;
  citations: AssistantSourceCitation[];
  onSelect: (citation: AssistantSourceCitation) => void;
}) {
  return (
    <div className="assistant-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const index = assistantCitationIndexFromHref(href);
            const citation = citations.find((item) => item.index === index);
            if (!citation)
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );

            return (
              <a
                {...props}
                className="assistant-inline-citation"
                href={assistantCitationTargetHref(citation)}
                aria-label={`Go to ${citation.label}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(citation);
                }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
