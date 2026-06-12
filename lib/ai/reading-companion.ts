export interface ReadingCompanionPrompt {
  label: string;
  prompt: string;
}

export const READING_COMPANION_PROMPTS: readonly ReadingCompanionPrompt[] = [
  {
    label: "Understand",
    prompt:
      "Help me understand this document. Summarize the core idea, then list the 3-5 details I should pay closest attention to while reading.",
  },
  {
    label: "Explain",
    prompt:
      "Explain the hardest or most important ideas in this document in plain language. Define any specialized terms before using them.",
  },
  {
    label: "Extract note",
    prompt:
      "Turn this document into a concise MDX reading note with sections for Summary, Key ideas, Notable quotes or details, and Open questions. Base it only on the document.",
  },
  {
    label: "Connect",
    prompt:
      "Identify concepts, people, tools, or questions in this document that could connect to future notes or follow-up reading. Base the suggestions only on this document, and do not claim access to other notes.",
  },
] as const;
