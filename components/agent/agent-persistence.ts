import type { StateStore } from "@/lib/state-store";
import type { ThreadData, ThreadMessage, ThreadStore } from "@/components/agent/agent-types";

export interface ThreadBinding {
  api: ThreadStore;
  state: StateStore;
  generation: number;
}

export type MessagePersistenceResult =
  | { status: "persisted"; thread: ThreadData }
  | { status: "missing" }
  | { status: "failed" };

export function loadOrCreateThreads(api: ThreadStore, state: StateStore): ThreadData[] {
  const existing = api.loadThreads(state);
  if (existing.length > 0) return existing;

  try {
    return [api.createThread(undefined, state)];
  } catch (error) {
    const recovered = api.loadThreads(state);
    if (recovered.length === 0) throw error;
    return recovered;
  }
}

export function recoverCreatedThread(
  binding: ThreadBinding,
  previousIds: ReadonlySet<string>
): { thread: ThreadData; threads: ThreadData[] } | null {
  try {
    const threads = binding.api.loadThreads(binding.state);
    const thread = threads.find((candidate) => !previousIds.has(candidate.id));
    return thread ? { thread, threads } : null;
  } catch {
    return null;
  }
}

export function recoverDeletedThreads(
  binding: ThreadBinding,
  deletedId: string
): ThreadData[] | null {
  try {
    const threads = binding.api.loadThreads(binding.state);
    return threads.some((thread) => thread.id === deletedId) ? null : threads;
  } catch {
    return null;
  }
}

function recoverPersistedMessage(
  binding: ThreadBinding,
  threadId: string,
  messageId: string
): ThreadData | null {
  try {
    const thread = binding.api.findThread(threadId, binding.state);
    return thread?.messages.some((message) => message.id === messageId) ? thread : null;
  } catch {
    return null;
  }
}

export function persistThreadMessage(
  binding: ThreadBinding,
  threadId: string,
  message: ThreadMessage
): MessagePersistenceResult {
  try {
    const thread = binding.api.addMessage(threadId, message, binding.state);
    return thread ? { status: "persisted", thread } : { status: "missing" };
  } catch {
    const thread = recoverPersistedMessage(binding, threadId, message.id);
    return thread ? { status: "persisted", thread } : { status: "failed" };
  }
}
