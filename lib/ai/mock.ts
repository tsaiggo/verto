// Mock assistant backend for local development, demos, and tests.
//
// Lets the Reading companion run end-to-end (chat, tool calls, write
// confirmations) without a real GitHub token. Deterministic, offline, no
// network. Selected with NEXT_PUBLIC_VERTO_ASSISTANT=mock; disabled by default.

import type { AssistantProvider, ChatMessage, ChatResult } from "./types";

const FILLER = /\b(intentionally|a little|overly|really|just|basically|so that you have something worth improving|in order to|very|simply)\b/gi;

function tighten(passage: string): string {
  const cut = passage.replace(FILLER, "").replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").trim();
  return cut && cut !== passage.trim() ? cut : `${passage.trim()} (tightened)`;
}

function extractSelection(messages: ChatMessage[]): string | null {
  const last = messages[messages.length - 1]?.content ?? "";
  const m = last.split("--- PASSAGE ---")[1];
  return m ? m.trim() : null;
}

function quotedPhrase(text: string): string | null {
  const m = text.match(/"([^"]{4,120})"/);
  return m ? m[1] : null;
}

export function createMockProvider(): AssistantProvider {
  return {
    id: "mock",
    model: "mock/preview",
    async chat(messages: ChatMessage[]): Promise<ChatResult> {
      await new Promise((r) => setTimeout(r, 500));
      const selection = extractSelection(messages);
      if (selection) return { content: tighten(selection), model: "mock/preview" };
      return {
        content:
          "This is a mocked reply for the local demo. The reading companion is wired up; connect a real GitHub Models token to get grounded answers.",
        model: "mock/preview",
      };
    },
    async agentChat(messages: ChatMessage[]): Promise<ChatResult> {
      await new Promise((r) => setTimeout(r, 600));
      const done = messages.some((m) => m.role === "tool");
      if (done) {
        return {
          content: "Done. I highlighted that passage and saved a note for you.",
          model: "mock/preview",
        };
      }
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const wantsWrite = /highlight|note|save|标注|高亮|笔记|保存/i.test(lastUser);
      if (wantsWrite) {
        const quote = quotedPhrase(lastUser) ?? "reading companion";
        return {
          content: "I'll highlight that passage and attach a quick note.",
          model: "mock/preview",
          toolCalls: [
            {
              id: "mock-1",
              name: "create_highlight_note",
              args: JSON.stringify({ quote, note: "Worth revisiting." }),
            },
          ],
        };
      }
      return {
        content: MOCK_ANSWER,
        model: "mock/preview",
      };
    },
  };
}

const MOCK_ANSWER = `Here's a quick read of this document.

## TL;DR
Verto is an MDX reader you point at a folder of notes; the reading companion can explain, annotate, and reshape passages as you read.

## Key points
- **Folder is the source of truth** - no database, no admin UI.
- **Inline annotations** turn footnotes into popovers.
- **Agent actions** (highlight, note, summarize) always ask before they write.

## Try next
1. Select a sentence and press **Ask AI**.
2. Ask me to *highlight the first paragraph*.

Want me to save this as a summary?`;

