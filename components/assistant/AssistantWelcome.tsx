"use client";

// Empty-state welcome for the reading companion.
//
// The starter actions expose Verto's real document tools instead of presenting
// a generic chat empty state. Each row sends immediately on tap.

import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  BookOpenText,
  CornerDownLeft,
  ListTree,
  NotebookPen,
  Save,
  type LucideIcon,
} from "lucide-react";

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: ListTree,
    label: "Outline this document",
    prompt: "Outline this document by section and connect its main ideas.",
  },
  {
    icon: NotebookPen,
    label: "Review my notes",
    prompt:
      "Review the highlights and notes I have saved for this document. Group them by theme and call out gaps.",
  },
  {
    icon: Save,
    label: "Prepare a saved summary",
    prompt: "Draft a concise summary of this document, then ask me before saving it to my library.",
  },
];

export function AssistantWelcome({
  onPick,
  busy,
  contextNote,
  documentOpen,
}: {
  onPick: (prompt: string) => void;
  busy: boolean;
  contextNote?: string;
  documentOpen: boolean;
}) {
  if (!documentOpen) {
    return (
      <div className="assistant-welcome">
        <p className="assistant-welcome-h">Open a document to use Companion</p>
        <p className="assistant-welcome-sub">
          Companion works with one open document, its notes, and its saved summary.
        </p>
        <div className="assistant-suggest-list" aria-label="Available workspace actions">
          <Link className="assistant-suggest no-underline" href="/library">
            <span className="assistant-suggest-chip" aria-hidden>
              <BookOpenText className="h-[15px] w-[15px]" />
            </span>
            <span className="assistant-suggest-label">Choose a document</span>
            <span className="assistant-suggest-arrow" aria-hidden>
              <ArrowUpRight className="h-[15px] w-[15px]" />
            </span>
          </Link>
          <Link className="assistant-suggest no-underline" href="/agent">
            <span className="assistant-suggest-chip" aria-hidden>
              <Bot className="h-[15px] w-[15px]" />
            </span>
            <span className="assistant-suggest-label">Ask across the library</span>
            <span className="assistant-suggest-arrow" aria-hidden>
              <ArrowUpRight className="h-[15px] w-[15px]" />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-welcome">
      <p className="assistant-welcome-h">Work from this document</p>
      <p className="assistant-welcome-sub">
        {contextNote ?? "Context: current document, notes, and saved summary."}
      </p>
      <div className="assistant-suggest-list">
        {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            className="assistant-suggest"
            onClick={() => onPick(prompt)}
            disabled={busy}
          >
            <span className="assistant-suggest-chip" aria-hidden>
              <Icon className="h-[15px] w-[15px]" />
            </span>
            <span className="assistant-suggest-label">{label}</span>
            <span className="assistant-suggest-arrow" aria-hidden>
              <CornerDownLeft className="h-[15px] w-[15px]" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
