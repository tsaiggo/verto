// Mock assistant backend for local development, demos, and tests.
//
// Lets the Reading companion run end-to-end (chat, tool calls, write
// confirmations) without a real assistant access key. Deterministic, offline, no
// network. Selected with NEXT_PUBLIC_VERTO_ASSISTANT=mock; disabled by default.

import type { AssistantProvider, ChatMessage, ChatResult } from "./types";

const FILLER =
  /\b(intentionally|a little|overly|really|just|basically|so that you have something worth improving|in order to|very|simply)\b/gi;

function tighten(passage: string): string {
  const cut = passage
    .replace(FILLER, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
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

function completedTool(messages: ChatMessage[]): { name: string; result: string } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "tool") continue;
    for (let callIndex = index - 1; callIndex >= 0; callIndex -= 1) {
      const call = messages[callIndex].toolCalls?.find(
        (candidate) => candidate.id === message.toolCallId
      );
      if (call) return { name: call.name, result: message.content.trim() };
    }
    if (message.content.trim() === "Summary saved.") {
      return { name: "save_summary", result: message.content.trim() };
    }
    if (message.content.trim() === "Highlight saved.") {
      return { name: "create_highlight_note", result: message.content.trim() };
    }
    return null;
  }
  return null;
}

function toolCompletion(name: string, result: string): string {
  const declined = result === "Reader declined.";
  if (name === "save_summary") {
    if (declined) return "No summary was saved. Your library is unchanged.";
    if (result === "Summary saved.") {
      return "Saved. The summary is now available in your library and Studio.";
    }
    return `I couldn't save the summary: ${result}`;
  }
  if (name === "create_highlight_note") {
    if (declined) return "No highlight or note was saved.";
    if (result === "Highlight saved.") {
      return "Done. I highlighted that passage and saved the note.";
    }
    return `I couldn't save the highlight: ${result}`;
  }
  if (name === "list_notes") {
    if (result === "No notes yet.") {
      return "You don't have any saved highlights or notes for this document yet.";
    }
    return `Here's a review grounded in your saved notes:

${result}

**Theme**
These notes center on the passages you chose to preserve.

**Gap**
The saved notes do not yet include enough context for a deeper thematic grouping.`;
  }
  return `Completed ${name.replace(/_/g, " ")}: ${result}`;
}

const SAVED_SUMMARY = `## Summary

Verto turns a folder of Markdown and MDX notes into a focused reading workspace. The reading companion can explain passages, review saved notes, and propose changes while keeping the reader in control of every write.

## Key points

- The source folder remains the source of truth.
- Highlights and notes stay attached to the document.
- Mutating assistant actions require confirmation before they are saved.`;

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
          "This is a mocked reply for the local demo. The reading companion is wired up; add a real assistant access key to get grounded answers.",
        model: "mock/preview",
      };
    },
    async agentChat(messages: ChatMessage[]): Promise<ChatResult> {
      await new Promise((r) => setTimeout(r, 600));
      const completed = completedTool(messages);
      if (completed) {
        return {
          content: toolCompletion(completed.name, completed.result),
          model: "mock/preview",
        };
      }
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const wantsNotesReview =
        /\b(review|list|show|read|organize|group)\b.{0,48}\b(notes?|highlights?)\b|\b(notes?|highlights?)\b.{0,48}\b(review|list|show|read|organize|group)\b|查看.{0,24}(笔记|高亮)|(笔记|高亮).{0,24}(回顾|整理|查看)/i.test(
          lastUser
        );
      if (wantsNotesReview) {
        return {
          content: "I'll review the notes saved for this document.",
          model: "mock/preview",
          toolCalls: [{ id: "mock-1", name: "list_notes", args: "{}" }],
        };
      }
      const wantsSavedSummary =
        /(summary|summaries|summarize|summarise|总结|摘要)/i.test(lastUser) &&
        /(save|saved|saving|persist|library|保存|存入)/i.test(lastUser);
      if (wantsSavedSummary) {
        return {
          content: "I prepared a concise summary. Review it before I save it to your library.",
          model: "mock/preview",
          toolCalls: [
            {
              id: "mock-1",
              name: "save_summary",
              args: JSON.stringify({ body: SAVED_SUMMARY }),
            },
          ],
        };
      }
      const wantsHighlight =
        /highlight|标注|高亮/i.test(lastUser) ||
        /(?:save|add|create|write|attach|保存|添加|创建).{0,32}(?:note|笔记)|(?:note|笔记).{0,32}(?:save|add|create|write|attach|保存|添加|创建)/i.test(
          lastUser
        );
      if (wantsHighlight) {
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

This preview answer is read-only; no library item was created.`;
