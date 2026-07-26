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
import type { MutationReceipt } from "@/lib/ai/mutation-receipt";

// ── Exported types ──────────────────────────────────────────────────

export type AgentThreadScope =
  | { kind: "workspace" }
  | {
      kind: "document";
      href: string;
      slug: string[];
      title: string;
    };

export interface AgentThreadCitation {
  index: number;
  label: string;
  href: string;
  /** Stable passage id exposed to the model. */
  sourceId?: string;
  /** Rendered document id used to restore focus. */
  targetId?: string;
  /** Exact source passage retained for stale-anchor recovery. */
  excerpt?: string;
}

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
  citations?: AgentThreadCitation[];
  /** Receipt for an approved Agent mutation, retained so it can be undone later. */
  receipt?: MutationReceipt;
}

/** A persisted conversation thread. */
export interface AgentThreadData {
  id: string;
  title: string;
  /**
   * Always present on values returned by this module. Optional in the public
   * shape so pre-scope in-memory snapshots remain source compatible while
   * they pass through the migration boundary.
   */
  scope?: AgentThreadScope;
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

const WORKSPACE_SCOPE: AgentThreadScope = { kind: "workspace" };
const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const EXTERNAL_REF = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function safeText(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== "string" || value.length > maxLength || FORBIDDEN_CONTROL.test(value)) {
    return null;
  }
  if (!allowEmpty && value.trim() === "") return null;
  return value;
}

function safeLocalRef(value: unknown, maxLength = 2048): string | null {
  const text = safeText(value, maxLength);
  if (text === null) return null;
  const normalized = text.trim();
  return EXTERNAL_REF.test(normalized) || normalized.includes("\\") ? null : normalized;
}

function safeAnchorId(value: unknown): string | null {
  const id = safeLocalRef(value, 256);
  if (id === null || /[\s"'<>]/.test(id)) return null;
  return id;
}

function normalizeSlug(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 128) return null;
  const slug: string[] = [];
  for (const segment of value) {
    const normalized = safeLocalRef(segment, 256);
    if (normalized === null || normalized.includes("/")) return null;
    slug.push(normalized);
  }
  return slug;
}

function normalizeScope(value: unknown): AgentThreadScope | null {
  // Accept the early string representation on read, but always emit the
  // discriminated object shape used by current callers.
  if (value === "workspace") return { ...WORKSPACE_SCOPE };
  if (!isRecord(value)) return null;
  if (value.kind === "workspace") return { ...WORKSPACE_SCOPE };
  if (value.kind !== "document") return null;

  const href = safeInternalHref(value.href);
  const slug = normalizeSlug(value.slug);
  const title = safeText(value.title, 512);
  if (href === null || slug === null || title === null) return null;
  return { kind: "document", href, slug, title: title.trim() };
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
  return href.length <= 2048 && /^\/(?!\/)[^\\\u0000-\u001f\u007f]*$/.test(href) ? href : null;
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
  const sourceId = safeAnchorId(value.sourceId);
  const targetId = safeAnchorId(value.targetId);
  const excerpt = safeText(value.excerpt, 8_000);
  return {
    index: value.index as number,
    label: value.label.trim(),
    href,
    ...(sourceId ? { sourceId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(excerpt ? { excerpt } : {}),
  };
}

type AnnotationReceipt = Extract<MutationReceipt, { kind: "annotation.create" }>;
type SummaryReceipt = Extract<MutationReceipt, { kind: "summary.upsert" }>;
type ReceiptAnnotation = AnnotationReceipt["after"];
type ReceiptSummary = SummaryReceipt["after"];

function safeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return value;
}

function normalizeAnnotationTurn(value: unknown): ReceiptAnnotation["turns"][number] | null {
  if (!isRecord(value)) return null;
  const id = safeAnchorId(value.id);
  const body = safeText(value.body, 24_000, true);
  const createdAt = safeTimestamp(value.createdAt);
  if (
    id === null ||
    body === null ||
    createdAt === null ||
    (value.author !== "human" && value.author !== "ai")
  ) {
    return null;
  }
  const model = value.author === "ai" ? safeText(value.model, 256) : null;
  return {
    id,
    author: value.author,
    body,
    createdAt,
    ...(model ? { model: model.trim() } : {}),
  };
}

function normalizeReceiptAnnotation(value: unknown): ReceiptAnnotation | null {
  if (!isRecord(value) || !isRecord(value.anchor) || !Array.isArray(value.turns)) return null;
  const id = safeAnchorId(value.id);
  const docSlug = safeLocalRef(value.docSlug);
  const quote = safeText(value.quote, 16_000);
  const anchorQuote = safeText(value.anchor.quote, 16_000);
  const prefix = safeText(value.anchor.prefix, 512, true);
  const suffix = safeText(value.anchor.suffix, 512, true);
  const color = safeAnchorId(value.color);
  const createdAt = safeTimestamp(value.createdAt);
  const updatedAt = safeTimestamp(value.updatedAt);
  if (
    id === null ||
    docSlug === null ||
    quote === null ||
    anchorQuote === null ||
    anchorQuote !== quote ||
    prefix === null ||
    suffix === null ||
    !Number.isSafeInteger(value.anchor.start) ||
    (value.anchor.start as number) < 0 ||
    color === null ||
    createdAt === null ||
    updatedAt === null ||
    value.turns.length > 64
  ) {
    return null;
  }
  const turns = value.turns
    .map(normalizeAnnotationTurn)
    .filter((turn): turn is ReceiptAnnotation["turns"][number] => turn !== null);
  if (turns.length !== value.turns.length) return null;
  return {
    id,
    docSlug,
    quote,
    anchor: { quote: anchorQuote, prefix, suffix, start: value.anchor.start as number },
    color,
    turns,
    createdAt,
    updatedAt,
  };
}

function normalizeReceiptSummary(value: unknown): ReceiptSummary | null {
  if (!isRecord(value)) return null;
  const href = safeInternalHref(value.href);
  const slug = normalizeSlug(value.slug);
  const title = safeText(value.title, 512);
  const body = safeText(value.body, 100_000);
  const model = safeText(value.model, 256, true);
  const createdAt = safeTimestamp(value.createdAt);
  if (
    href === null ||
    slug === null ||
    title === null ||
    body === null ||
    model === null ||
    createdAt === null
  ) {
    return null;
  }
  const contextNote = safeText(value.contextNote, 2_000);
  return {
    href,
    slug,
    title: title.trim(),
    body,
    model,
    ...(contextNote ? { contextNote: contextNote.trim() } : {}),
    createdAt,
  };
}

function normalizeReceipt(value: unknown): MutationReceipt | null {
  if (!isRecord(value)) return null;
  const createdAt = safeTimestamp(value.createdAt);
  const undoneAt = value.undoneAt === undefined ? null : safeTimestamp(value.undoneAt);
  if (createdAt === null || (value.undoneAt !== undefined && undoneAt === null)) return null;

  if (value.kind === "annotation.create") {
    const after = normalizeReceiptAnnotation(value.after);
    if (!after) return null;
    return {
      kind: "annotation.create",
      after,
      createdAt,
      ...(undoneAt ? { undoneAt } : {}),
    };
  }

  if (value.kind === "summary.upsert") {
    const after = normalizeReceiptSummary(value.after);
    const before = value.before === null ? null : normalizeReceiptSummary(value.before);
    if (!after || (value.before !== null && !before) || (before && before.href !== after.href)) {
      return null;
    }
    return {
      kind: "summary.upsert",
      before,
      after,
      createdAt,
      ...(undoneAt ? { undoneAt } : {}),
    };
  }

  return null;
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
  const receipt = normalizeReceipt(value.receipt);

  return {
    id: value.id,
    role: value.role,
    text: value.text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(typeof value.toolCallId === "string" ? { toolCallId: value.toolCallId } : {}),
    ...(list.length > 0 ? { list } : {}),
    ...(citations.length > 0 ? { citations } : {}),
    ...(receipt ? { receipt } : {}),
  };
}

function normalizeThread(value: unknown): AgentThreadData | null {
  if (!isRecord(value) || typeof value.id !== "string" || !Array.isArray(value.messages)) {
    return null;
  }
  const scope = value.scope === undefined ? { ...WORKSPACE_SCOPE } : normalizeScope(value.scope);
  if (!scope) return null;
  const fallbackDate = new Date(0).toISOString();
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "New Chat",
    scope,
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
  // Workspace is the backward-compatible default, so omitting it on disk
  // keeps portable histories compatible with pre-scope clients. Every read
  // expands the omission back to an explicit `{ kind: "workspace" }`.
  const portable = threads.map((thread) =>
    thread.scope?.kind === "workspace" ? { ...thread, scope: undefined } : thread
  );
  s.write<ThreadStore>(STORE_NAME, { threads: portable });
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
export function createThread(title?: string, store?: StateStore): AgentThreadData;
export function createThread(
  title: string | undefined,
  scope: AgentThreadScope,
  store?: StateStore
): AgentThreadData;
export function createThread(
  title: string | undefined,
  store: StateStore | undefined,
  scope: AgentThreadScope
): AgentThreadData;
export function createThread(
  title?: string,
  storeOrScope?: StateStore | AgentThreadScope,
  scopeOrStore?: AgentThreadScope | StateStore
): AgentThreadData {
  const scopeInSecondPosition =
    isRecord(storeOrScope) &&
    (storeOrScope.kind === "workspace" || storeOrScope.kind === "document");
  const store = (scopeInSecondPosition ? scopeOrStore : storeOrScope) as StateStore | undefined;
  const scopeInput = (scopeInSecondPosition ? storeOrScope : scopeOrStore) as
    | AgentThreadScope
    | undefined;
  const scope = scopeInput === undefined ? { ...WORKSPACE_SCOPE } : normalizeScope(scopeInput);
  const now = new Date().toISOString();
  const thread: AgentThreadData = {
    id: newId(),
    title: title ?? "New Chat",
    scope: scope ?? { ...WORKSPACE_SCOPE },
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
 * Restore a previously deleted thread. The original id, messages, and
 * timestamps are preserved so an undo does not create a second conversation.
 * Returns `false` when the snapshot is invalid or its id already exists.
 */
export function restoreThread(thread: AgentThreadData, store?: StateStore): boolean {
  const restored = normalizeThread(thread);
  if (!restored) return false;

  const threads = loadThreads(store);
  if (threads.some((existing) => existing.id === restored.id)) return false;

  // Preserve a legacy snapshot byte-for-byte at the write boundary. The next
  // read still migrates it to an explicit workspace scope via normalizeThread.
  threads.unshift(
    restored.scope?.kind === "workspace" ? { ...restored, scope: undefined } : restored
  );
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
  const normalized = normalizeMessage(message);
  if (!normalized) return null;
  thread.messages.push(normalized);
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
  thread.messages = messages
    .map(normalizeMessage)
    .filter((message): message is AgentThreadMessage => message !== null);
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
  citations?: AgentThreadMessage["citations"],
  receipt?: MutationReceipt
): AgentThreadMessage {
  return {
    id: newId(),
    role: msg.role === "tool" ? "tool" : msg.role === "assistant" ? "agent" : "user",
    text: msg.content,
    toolCalls: msg.toolCalls,
    toolCallId: msg.toolCallId,
    list,
    citations,
    receipt,
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
