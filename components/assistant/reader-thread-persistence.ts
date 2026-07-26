import type {
  AgentThreadCitation,
  AgentThreadData,
  AgentThreadMessage,
  AgentThreadScope,
} from "@/lib/agent-threads";
import { newId } from "@/lib/agent-threads";
import type { AgentStep } from "@/lib/ai/agent";
import type { MutationReceipt } from "@/lib/ai/mutation-receipt";
import type { SummaryDocRef } from "@/lib/summaries";
import type { AssistantSourceCitation } from "@/components/assistant/source-citations";

export interface ReaderThreadTurnSnapshot {
  role: "user" | "assistant";
  content: string;
  threadMessageId: string;
  steps?: AgentStep[];
  citations?: AssistantSourceCitation[];
}

function receiptStep(receipt: MutationReceipt): AgentStep {
  return {
    name: receipt.kind === "annotation.create" ? "create_highlight_note" : "save_summary",
    args: "",
    result: receipt.undoneAt ? "Change undone." : "Change applied.",
    ok: true,
    receipt,
  };
}

function citationFromThread(citation: AgentThreadCitation): AssistantSourceCitation | null {
  if (!citation.sourceId || !citation.targetId || !citation.excerpt) return null;
  return {
    id: citation.sourceId,
    targetId: citation.targetId,
    label: citation.label,
    text: citation.excerpt,
    index: citation.index,
  };
}

function citationForThread(
  citation: AssistantSourceCitation,
  documentHref: string
): AgentThreadCitation {
  return {
    index: citation.index,
    label: citation.label,
    href: documentHref,
    sourceId: citation.id,
    targetId: citation.targetId,
    excerpt: citation.text,
  };
}

export function documentThreadScope(doc: SummaryDocRef): AgentThreadScope {
  return {
    kind: "document",
    href: doc.href,
    slug: [...doc.slug],
    title: doc.title,
  };
}

export function findLatestDocumentThread(
  threads: AgentThreadData[],
  doc: Pick<SummaryDocRef, "href">
): AgentThreadData | null {
  return (
    threads
      .filter((thread) => thread.scope?.kind === "document" && thread.scope.href === doc.href)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null
  );
}

export function readerTurnsFromThread(thread: AgentThreadData): ReaderThreadTurnSnapshot[] {
  const turns: ReaderThreadTurnSnapshot[] = [];
  for (const message of thread.messages) {
    if (message.role === "tool") continue;
    if (message.role === "user") {
      turns.push({
        role: "user",
        content: message.text,
        threadMessageId: message.id,
      });
      continue;
    }

    const citations = (message.citations ?? [])
      .map(citationFromThread)
      .filter((citation): citation is AssistantSourceCitation => citation !== null);
    turns.push({
      role: "assistant",
      content: message.text,
      threadMessageId: message.id,
      ...(message.receipt ? { steps: [receiptStep(message.receipt)] } : {}),
      ...(citations.length > 0 ? { citations } : {}),
    });
  }
  return turns;
}

export function readerUserMessage(content: string): AgentThreadMessage {
  return {
    id: newId(),
    role: "user",
    text: content,
  };
}

export function readerAssistantMessage({
  content,
  citations,
  steps,
  documentHref,
}: {
  content: string;
  citations: AssistantSourceCitation[];
  steps: AgentStep[];
  documentHref: string;
}): AgentThreadMessage {
  const receipt = [...steps].reverse().find((step) => step.receipt)?.receipt;
  return {
    id: newId(),
    role: "agent",
    text: content,
    ...(citations.length > 0
      ? { citations: citations.map((citation) => citationForThread(citation, documentHref)) }
      : {}),
    ...(receipt ? { receipt } : {}),
  };
}

function sameReceipt(left: MutationReceipt | undefined, right: MutationReceipt): boolean {
  return left?.kind === right.kind && left.createdAt === right.createdAt;
}

export function updateReaderMessageReceipt(
  messages: AgentThreadMessage[],
  messageId: string,
  previousReceipt: MutationReceipt,
  nextReceipt: MutationReceipt
): AgentThreadMessage[] | null {
  let changed = false;
  const next = messages.map((message) => {
    if (message.id !== messageId || !sameReceipt(message.receipt, previousReceipt)) {
      return message;
    }
    changed = true;
    return { ...message, receipt: nextReceipt };
  });
  return changed ? next : null;
}
