// Agent-chat thread persistence backed by StateStore.
//
// Threads are persisted as a list under the `agent-threads` store key
// (→ `verto:agent-threads` in localStorage, `.verto/agent-threads.json`
// on the desktop). Each thread holds its message history, a title
// auto-derived from the first user turn, and timestamps.
//
// Reads and mutations are synchronous after `hydrateThreads()` has restored
// the selected desktop vault. Callers that can write during startup must await
// that gate first so an empty browser cache cannot overwrite portable history.

import { getStateStore, type StateStore } from "@/lib/state-store";
import type { ChatMessage } from "@/lib/ai/types";

// ── Exported types ──────────────────────────────────────────────────

/** A single message in a persisted thread. */
export interface AgentThreadMessage {
  id: string;
  role: "user" | "agent" | "tool";
  text: string;
  /** Tool calls the agent requested (present on assistant turns). */
  toolCalls?: Array<{ id: string; name: string; args: string }>;
  /** Tool-call id echoed back on tool-result messages. */
  toolCallId?: string;
  /** Optional structured list items (Vert display extension). */
  list?: Array<{ term: string; text: string }>;
  /** Optional citations for agent replies. */
  citations?: Array<{ index: number; label: string; href: string }>;
}

/** A persisted conversation thread. */
export interface AgentThreadData {
  id: string;
  title: string;
  messages: AgentThreadMessage[];
  createdAt: string;
  updatedAt: string;
}

/** The shape stored under `agent-threads`. */
interface ThreadStore {
  threads: AgentThreadData[];
}

// ── Store key ───────────────────────────────────────────────────────

const STORE_NAME = "agent-threads";

// ── Helpers ─────────────────────────────────────────────────────────

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Derive a short title from the first user message. */
function inferTitle(messages: AgentThreadMessage[]): string {
  for (const m of messages) {
    if (m.role === "user") {
      const text = m.text.trim();
      // Use the first line or first ~60 chars.
      const firstLine = text.split("\n")[0] ?? text;
      return firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
    }
  }
  return "New Chat";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeToolCall(
  value: unknown
): NonNullable<AgentThreadMessage["toolCalls"]>[number] | null {
  if (!isRecord(value)) return null;
  return typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.args === "string"
    ? { id: value.id, name: value.name, args: value.args }
    : null;
}

function normalizeListItem(value: unknown): NonNullable<AgentThreadMessage["list"]>[number] | null {
  if (!isRecord(value) || typeof value.term !== "string" || typeof value.text !== "string") {
    return null;
  }
  return { term: value.term, text: value.text };
}

function safeInternalHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  return /^\/(?!\/)[^\\\u0000-\u001f]*$/.test(href) ? href : null;
}

function normalizeCitation(
  value: unknown
): NonNullable<AgentThreadMessage["citations"]>[number] | null {
  if (!isRecord(value)) return null;
  const href = safeInternalHref(value.href);
  if (
    !Number.isSafeInteger(value.index) ||
    (value.index as number) < 1 ||
    typeof value.label !== "string" ||
    value.label.trim() === "" ||
    href === null
  ) {
    return null;
  }
  return { index: value.index as number, label: value.label, href };
}

function normalizeMessage(value: unknown): AgentThreadMessage | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.text !== "string") return null;
  if (value.role !== "user" && value.role !== "agent" && value.role !== "tool") return null;

  const toolCalls = Array.isArray(value.toolCalls)
    ? value.toolCalls
        .map(normalizeToolCall)
        .filter(
          (item): item is NonNullable<AgentThreadMessage["toolCalls"]>[number] => item !== null
        )
    : [];
  const list = Array.isArray(value.list)
    ? value.list
        .map(normalizeListItem)
        .filter((item): item is NonNullable<AgentThreadMessage["list"]>[number] => item !== null)
    : [];
  const citations = Array.isArray(value.citations)
    ? value.citations
        .map(normalizeCitation)
        .filter(
          (item): item is NonNullable<AgentThreadMessage["citations"]>[number] => item !== null
        )
    : [];

  return {
    id: value.id,
    role: value.role,
    text: value.text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(typeof value.toolCallId === "string" ? { toolCallId: value.toolCallId } : {}),
    ...(list.length > 0 ? { list } : {}),
    ...(citations.length > 0 ? { citations } : {}),
  };
}

function normalizeThread(value: unknown): AgentThreadData | null {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.messages)) {
    return null;
  }
  const fallbackDate = new Date(0).toISOString();
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "New Chat",
    messages: value.messages
      .map(normalizeMessage)
      .filter((message): message is AgentThreadMessage => message !== null),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : fallbackDate,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallbackDate,
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Read all persisted threads. Returns an empty array on first use or error.
 */
export function loadThreads(store?: StateStore): AgentThreadData[] {
  const s = store ?? getStateStore();
  const data = s.read<unknown>(STORE_NAME, { threads: [] });
  if (!isRecord(data) || !Array.isArray(data.threads)) return [];
  return data.threads
    .map(normalizeThread)
    .filter((thread): thread is AgentThreadData => thread !== null);
}

/** Restore portable thread history for the selected vault before mutating it. */
export async function hydrateThreads(store?: StateStore): Promise<void> {
  const s = store ?? getStateStore();
  await s.hydrate?.(STORE_NAME);
}

/**
 * Overwrite the full thread list. Used by save/delete/create.
 */
function saveThreads(threads: AgentThreadData[], store?: StateStore): void {
  const s = store ?? getStateStore();
  s.write<ThreadStore>(STORE_NAME, { threads });
}

/**
 * Return a single thread by id, or `null` when not found.
 */
export function findThread(id: string, store?: StateStore): AgentThreadData | null {
  return loadThreads(store).find((t) => t.id === id) ?? null;
}

/**
 * Create a new empty thread and return it. The thread is persisted immediately.
 */
export function createThread(title?: string, store?: StateStore): AgentThreadData {
  const now = new Date().toISOString();
  const thread: AgentThreadData = {
    id: newId(),
    title: title ?? "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const threads = loadThreads(store);
  threads.unshift(thread);
  saveThreads(threads, store);
  return thread;
}

/**
 * Delete a thread by id. Returns `true` if the thread existed.
 */
export function deleteThread(id: string, store?: StateStore): boolean {
  const threads = loadThreads(store);
  const idx = threads.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  threads.splice(idx, 1);
  saveThreads(threads, store);
  return true;
}

/**
 * Append a message to a thread and update its `updatedAt` timestamp. If
 * the thread has no title yet (placeholder), re-derive it from the first
 * user message.
 */
export function addMessage(
  threadId: string,
  message: AgentThreadMessage,
  store?: StateStore
): AgentThreadData | null {
  const threads = loadThreads(store);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.messages.push(message);
  thread.updatedAt = new Date().toISOString();
  if (thread.title === "New Chat" || thread.title === "") {
    thread.title = inferTitle(thread.messages);
  }
  saveThreads(threads, store);
  return thread;
}

/**
 * Replace the full message array of a thread (used when restoring a thread
 * from the persisted list). Returns the updated thread or null.
 */
export function replaceMessages(
  threadId: string,
  messages: AgentThreadMessage[],
  store?: StateStore
): AgentThreadData | null {
  const threads = loadThreads(store);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.messages = messages;
  thread.updatedAt = new Date().toISOString();
  if (thread.title === "New Chat" || thread.title === "") {
    thread.title = inferTitle(thread.messages);
  }
  saveThreads(threads, store);
  return thread;
}

/**
 * Update a thread's title.
 */
export function renameThread(id: string, title: string, store?: StateStore): boolean {
  const threads = loadThreads(store);
  const thread = threads.find((t) => t.id === id);
  if (!thread) return false;
  thread.title = title.trim() || "New Chat";
  thread.updatedAt = new Date().toISOString();
  saveThreads(threads, store);
  return true;
}

/**
 * Subscribe to store changes. Returns an unsubscribe function. Use with
 * React's `useSyncExternalStore` for reactive re-renders.
 */
export function subscribeThreads(listener: () => void, store?: StateStore): () => void {
  const s = store ?? getStateStore();
  return s.subscribe(listener);
}

/**
 * Convert a persisted `AgentThreadMessage` to the `ChatMessage` format
 * expected by `runAgent` / providers.
 */
export function toChatMessage(m: AgentThreadMessage): ChatMessage {
  const role: ChatMessage["role"] = m.role === "agent" ? "assistant" : m.role;
  const base: ChatMessage = { role, content: m.text };
  if (m.toolCalls?.length) {
    base.toolCalls = m.toolCalls;
  }
  if (m.toolCallId) {
    base.toolCallId = m.toolCallId;
  }
  return base;
}

/**
 * Convert a `ChatMessage` (from the agent loop) back to a persisted
 * `AgentThreadMessage`, assigning a unique id.
 */
export function fromChatMessage(
  msg: ChatMessage,
  list?: AgentThreadMessage["list"],
  citations?: AgentThreadMessage["citations"]
): AgentThreadMessage {
  return {
    id: newId(),
    role: msg.role === "tool" ? "tool" : msg.role === "assistant" ? "agent" : "user",
    text: msg.content,
    toolCalls: msg.toolCalls,
    toolCallId: msg.toolCallId,
    list,
    citations,
  };
}

/**
 * Derive grouping labels for the thread-list sidebar based on recency.
 * Returns "Today", "Yesterday", "This Week", or "Older".
 */
export function threadGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (d >= weekAgo) return "This Week";
  return "Older";
}
