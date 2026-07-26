import { describe, expect, it } from "vitest";

import {
  documentThreadScope,
  findLatestDocumentThread,
  readerAssistantMessage,
  readerTurnsFromThread,
  updateReaderMessageReceipt,
} from "@/components/assistant/reader-thread-persistence";
import type { AgentThreadData } from "@/lib/agent-threads";
import type { MutationReceipt } from "@/lib/ai/mutation-receipt";

const doc = {
  href: "/read/notes/trust",
  slug: ["notes", "trust"],
  title: "Trust by design",
};

const receipt: MutationReceipt = {
  kind: "summary.upsert",
  before: null,
  after: {
    ...doc,
    body: "A grounded summary.",
    model: "mock",
    createdAt: "2026-07-26T09:00:00.000Z",
  },
  createdAt: "2026-07-26T09:00:00.000Z",
};

describe("Reader Agent thread persistence", () => {
  it("creates a document scope and restores the most recently updated matching thread", () => {
    const threads: AgentThreadData[] = [
      {
        id: "old",
        title: "Old",
        scope: documentThreadScope(doc),
        messages: [],
        createdAt: "2026-07-25T09:00:00.000Z",
        updatedAt: "2026-07-25T09:00:00.000Z",
      },
      {
        id: "other",
        title: "Other",
        scope: {
          kind: "document",
          href: "/read/other",
          slug: ["other"],
          title: "Other",
        },
        messages: [],
        createdAt: "2026-07-26T10:00:00.000Z",
        updatedAt: "2026-07-26T10:00:00.000Z",
      },
      {
        id: "latest",
        title: "Latest",
        scope: documentThreadScope(doc),
        messages: [],
        createdAt: "2026-07-26T09:00:00.000Z",
        updatedAt: "2026-07-26T09:00:00.000Z",
      },
    ];

    expect(findLatestDocumentThread(threads, doc)?.id).toBe("latest");
    expect(findLatestDocumentThread(threads, { href: "/read/missing" })).toBeNull();
  });

  it("round-trips grounded citations and the latest mutation receipt", () => {
    const message = readerAssistantMessage({
      content: "A grounded claim. [1](#verto-source-citation-1)",
      citations: [
        {
          id: "source-p-trust",
          targetId: "trust-passage",
          label: "Trust · paragraph 1",
          text: "Trust grows when actions stay inspectable.",
          index: 1,
        },
      ],
      steps: [
        {
          name: "save_summary",
          args: "{}",
          result: "Saved",
          ok: true,
          receipt,
        },
      ],
      documentHref: doc.href,
    });
    const thread: AgentThreadData = {
      id: "thread",
      title: "Grounded claim",
      scope: documentThreadScope(doc),
      messages: [message],
      createdAt: "2026-07-26T09:00:00.000Z",
      updatedAt: "2026-07-26T09:00:00.000Z",
    };

    expect(message.citations?.[0]).toMatchObject({
      href: doc.href,
      sourceId: "source-p-trust",
      targetId: "trust-passage",
      excerpt: "Trust grows when actions stay inspectable.",
    });
    expect(readerTurnsFromThread(thread)).toEqual([
      expect.objectContaining({
        role: "assistant",
        threadMessageId: message.id,
        citations: [
          expect.objectContaining({
            id: "source-p-trust",
            targetId: "trust-passage",
          }),
        ],
        steps: [expect.objectContaining({ name: "save_summary", receipt })],
      }),
    ]);
  });

  it("ignores legacy citations that cannot safely relocate a passage", () => {
    const thread: AgentThreadData = {
      id: "legacy",
      title: "Legacy",
      scope: documentThreadScope(doc),
      messages: [
        {
          id: "agent",
          role: "agent",
          text: "Old answer.",
          citations: [{ index: 1, label: "Old source", href: doc.href }],
        },
      ],
      createdAt: "2026-07-26T09:00:00.000Z",
      updatedAt: "2026-07-26T09:00:00.000Z",
    };

    expect(readerTurnsFromThread(thread)[0]?.citations).toBeUndefined();
  });

  it("updates an Undo receipt only when the persisted message still matches it", () => {
    const messages = [
      {
        id: "agent",
        role: "agent" as const,
        text: "Saved.",
        receipt,
      },
    ];
    const undone = { ...receipt, undoneAt: "2026-07-26T09:05:00.000Z" };

    expect(updateReaderMessageReceipt(messages, "agent", receipt, undone)?.[0]?.receipt).toEqual(
      undone
    );
    expect(updateReaderMessageReceipt(messages, "missing", receipt, undone)).toBeNull();
  });
});
