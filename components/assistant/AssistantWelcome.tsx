"use client";

// Empty-state welcome for the reading companion.
//
// Mirrors the OpenAI Docs-agent panel: a low-anchored heading plus a short list
// of tappable starter prompts. Each row sends immediately on tap, so the empty
// state gives way to the thread instantly. Kept in its own module so the panel
// component stays focused on conversation state.

import { AlignLeft, Compass, CornerDownLeft, Lightbulb, type LucideIcon } from "lucide-react";

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: AlignLeft,
    label: "Summarize this page",
    prompt: "Summarize this page in a few concise bullet points.",
  },
  {
    icon: Lightbulb,
    label: "Explain the key ideas",
    prompt: "Explain the key ideas on this page in plain language.",
  },
  {
    icon: Compass,
    label: "Suggest what to read next",
    prompt: "Based on this page, what should I read next?",
  },
];

export function AssistantWelcome({
  onPick,
  busy,
  contextNote,
}: {
  onPick: (prompt: string) => void;
  busy: boolean;
  contextNote?: string;
}) {
  return (
    <div className="assistant-welcome">
      <p className="assistant-welcome-h">What can I help you with?</p>
      <p className="assistant-welcome-sub">
        {contextNote ?? "Context: current page. Pick a starting point, or ask your own."}
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
