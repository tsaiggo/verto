"use client";

// Right-rail AI assistant panel.
//
// The reading companion uses the configured model backend and a manually saved
// access key. The key stays in localStorage on both web and desktop builds.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Check,
  MessageSquareText,
  PanelRightClose,
  Trash2,
  Undo2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AssistantAnswerMarkdown } from "@/components/assistant/AssistantAnswerMarkdown";
import { AssistantWelcome } from "@/components/assistant/AssistantWelcome";
import { PendingWriteCard } from "@/components/assistant/PendingWriteCard";
import { AssistantSourceEvidence } from "@/components/assistant/AssistantSourceEvidence";
import {
  focusAssistantSource,
  parseAssistantSources,
  type AssistantSourceCitation,
} from "@/components/assistant/source-citations";
import { tauriFetch, type FetchLike } from "@/lib/tauri";
import {
  createAssistantProvider,
  getAssistantConfig,
  AssistantError,
  type ChatMessage,
} from "@/lib/ai";
import { buildMessages, describeDocContextScope, readDocContextFromDom } from "@/lib/ai/context";
import { runAgent, type AgentStep } from "@/lib/ai/agent";
import { READING_TOOLS, readingToolCtx } from "@/lib/ai/tools/library";
import { loadWebKey } from "@/lib/ai/key-store";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  pendingWritePreview,
  type PendingWritePreview,
} from "@/components/assistant/pending-write";
import type { SummaryDocRef } from "@/lib/summaries";
import { undoMutationReceipt } from "@/lib/ai/mutation-receipt";
import { getStateStore, type StateStore } from "@/lib/state-store";
import {
  createThread,
  findThread,
  hydrateThreads,
  loadThreads,
  renameThread,
  replaceMessages,
} from "@/lib/agent-threads";
import {
  documentThreadScope,
  findLatestDocumentThread,
  readerAssistantMessage,
  readerTurnsFromThread,
  readerUserMessage,
  updateReaderMessageReceipt,
} from "@/components/assistant/reader-thread-persistence";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
  threadMessageId?: string;
  steps?: AgentStep[];
  citations?: AssistantSourceCitation[];
  invalidCitationCount?: number;
}

interface PendingWrite {
  preview: PendingWritePreview;
  resolve: (approved: boolean) => void;
}

const WRITE_LABELS: Record<string, string> = {
  create_highlight_note: "Save a highlight & note",
  save_summary: "Save a summary to your library",
};

let turnSeq = 0;
const nextTurnId = () => ++turnSeq;

function ConnectGate({
  configured,
  documentTitle,
}: {
  configured: boolean;
  documentTitle?: string;
}) {
  return (
    <div className="assistant-connect-gate">
      <p className="assistant-connect-title">Read with Agent</p>
      <p className="assistant-connect-copy">
        Ask questions with page-level evidence. Saving a note or summary always asks for your
        approval.
      </p>
      {documentTitle ? (
        <p className="assistant-connect-scope">Current page · {documentTitle}</p>
      ) : null}
      <Link className="assistant-connect-action" href="/settings/agent">
        {configured ? "Add access key" : "Choose AI provider"}
      </Link>
    </div>
  );
}

function readAssistantContext(fallbackTitle?: string) {
  const context = readDocContextFromDom();
  return context.title || !fallbackTitle ? context : { ...context, title: fallbackTitle };
}

function AccountAvatar() {
  return (
    <span className="assistant-avatar assistant-avatar-guest" aria-hidden>
      <User />
    </span>
  );
}
function TurnSteps({
  turn,
  onUndo,
}: {
  turn: Turn;
  onUndo: (turnId: number, stepIndex: number) => void;
}) {
  if (!turn.steps || turn.steps.length === 0) return null;
  return (
    <ul className="assistant-steps">
      {turn.steps.map((step, i) => (
        <li
          key={`${turn.id}-${i}`}
          className={`assistant-step${step.ok ? "" : " assistant-step-fail"}`}
        >
          {step.ok ? <Check className="assistant-step-tick" aria-hidden /> : <X aria-hidden />}
          <span>{WRITE_LABELS[step.name] ?? step.name.replace(/_/g, " ")}</span>
          {step.receipt ? (
            <button
              type="button"
              className="assistant-step-undo"
              disabled={Boolean(step.receipt.undoneAt)}
              onClick={() => onUndo(turn.id, i)}
            >
              <Undo2 aria-hidden />
              {step.receipt.undoneAt ? "Undone" : "Undo"}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Transcript({
  turns,
  pending,
  busy,
  listRef,
  onSuggest,
  onPendingDecision,
  contextNote,
  onUndo,
}: {
  turns: Turn[];
  pending: PendingWrite | null;
  busy: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onSuggest: (prompt: string) => void;
  onPendingDecision: (approved: boolean) => void;
  contextNote: string;
  onUndo: (turnId: number, stepIndex: number) => void;
}) {
  const selectCitation = (citation: AssistantSourceCitation) => {
    if (focusAssistantSource(citation)) return;
    toast.info("Source moved", {
      description: "This passage is no longer available in the current document.",
    });
  };

  return (
    <div className="assistant-panel-transcript" ref={listRef} aria-live="polite">
      {turns.length === 0 ? (
        <AssistantWelcome onPick={onSuggest} busy={busy} contextNote={contextNote} />
      ) : (
        turns.map((turn) =>
          turn.role === "assistant" ? (
            <div key={turn.id} className="assistant-turn assistant-turn--assistant">
              <div className="assistant-answer">
                <div className="assistant-kicker">
                  <MessageSquareText className="assistant-kicker-spark" aria-hidden />
                  Agent
                </div>
                <TurnSteps turn={turn} onUndo={onUndo} />
                <AssistantAnswerMarkdown
                  content={turn.content}
                  citations={turn.citations ?? []}
                  onSelect={selectCitation}
                />
                <AssistantSourceEvidence
                  citations={turn.citations ?? []}
                  invalidCitationCount={turn.invalidCitationCount}
                  onSelect={selectCitation}
                />
              </div>
            </div>
          ) : (
            <div key={turn.id} className="assistant-turn assistant-turn--user">
              <div className="assistant-question-stack">
                <div className="assistant-kicker assistant-kicker-you">
                  <AccountAvatar />
                  You
                </div>
                <div className="assistant-question">
                  <div className="assistant-question-body">{turn.content}</div>
                </div>
              </div>
            </div>
          )
        )
      )}
      {pending && <PendingWriteCard preview={pending.preview} onDecision={onPendingDecision} />}
      {busy && !pending && (
        <div className="assistant-turn assistant-turn--assistant">
          <div className="assistant-answer">
            <div className="assistant-kicker">
              <MessageSquareText className="assistant-kicker-spark" aria-hidden />
              Agent
            </div>
            <div className="assistant-thinking" aria-label="Thinking">
              <span className="assistant-shimmer" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({
  input,
  busy,
  onInput,
  onSend,
}: {
  input: string;
  busy: boolean;
  onInput: (v: string) => void;
  onSend: (prompt?: string) => void;
}) {
  return (
    <div className="assistant-panel-compose">
      <div className="assistant-compose">
        <textarea
          className="assistant-panel-input"
          placeholder="Ask Agent about this page…"
          value={input}
          rows={2}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          disabled={busy}
          aria-label="Your question"
        />
        <span className="assistant-compose-hint" aria-hidden>
          ↵ send
        </span>
        <button
          type="button"
          className="assistant-send"
          onClick={() => void onSend()}
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <ArrowUp className="assistant-send-icon" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function AssistantPanel({
  doc,
  onCollapse,
}: {
  doc?: SummaryDocRef;
  docked?: boolean;
  onCollapse?: () => void;
}) {
  const config = useMemo(() => getAssistantConfig(), []);
  const documentHref = doc?.href;
  const documentTitle = doc?.title;
  const documentSlugKey = JSON.stringify(doc?.slug ?? []);

  const [webKey, setWebKey] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [contextNote, setContextNote] = useState("Context: checking the current page…");
  const listRef = useRef<HTMLDivElement | null>(null);
  const requestId = useRef(0);
  const pendingRef = useRef<PendingWrite | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const threadStoreRef = useRef<StateStore | null>(null);
  const hydrationId = useRef(0);

  function settlePending(approved: boolean) {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(approved && current.preview.valid);
  }

  useEffect(() => {
    let disposed = false;

    async function restoreDocumentThread() {
      const hydration = ++hydrationId.current;
      requestId.current += 1;
      settlePending(false);
      setTurns([]);
      setInput("");
      setBusy(false);
      setError(null);
      setContextNote(describeDocContextScope(readAssistantContext(documentTitle)));
      threadIdRef.current = null;
      threadStoreRef.current = null;
      if (!documentHref || !documentTitle) return;

      const documentRef: SummaryDocRef = {
        href: documentHref,
        title: documentTitle,
        slug: JSON.parse(documentSlugKey) as string[],
      };

      const store = getStateStore();
      threadStoreRef.current = store;
      try {
        await hydrateThreads(store);
      } catch {
        if (disposed || hydration !== hydrationId.current) return;
        setError("Couldn’t restore this page’s Agent conversation.");
        return;
      }
      if (disposed || hydration !== hydrationId.current) return;

      const thread = findLatestDocumentThread(loadThreads(store), documentRef);
      threadIdRef.current = thread?.id ?? null;
      setTurns(
        thread
          ? readerTurnsFromThread(thread).map((turn) => ({
              ...turn,
              id: nextTurnId(),
            }))
          : []
      );
    }

    void restoreDocumentThread();
    const onFolderChanged = () => void restoreDocumentThread();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, onFolderChanged);
    return () => {
      disposed = true;
      hydrationId.current += 1;
      requestId.current += 1;
      settlePending(false);
      threadIdRef.current = null;
      threadStoreRef.current = null;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, onFolderChanged);
    };
  }, [documentHref, documentSlugKey, documentTitle]);

  useEffect(() => {
    const sync = () => setWebKey(loadWebKey());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);

  useEffect(() => {
    function onAsk(e: Event) {
      const quote = (e as CustomEvent<{ quote: string }>).detail?.quote?.trim();
      if (!quote) return;
      const clipped = quote.length > 280 ? `${quote.slice(0, 280)}…` : quote;
      setInput(`About this passage: "${clipped}"\n\n`);
    }
    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, []);

  const isMock = config.kind === "mock";
  const token = isMock ? "mock" : webKey;
  const needsKey = !config.enabled || (!isMock && !token);

  async function undoStep(turnId: number, stepIndex: number) {
    const turn = turns.find((item) => item.id === turnId);
    const step = turn?.steps?.[stepIndex];
    if (!step?.receipt) return;
    const previousReceipt = step.receipt;
    const result = await undoMutationReceipt(previousReceipt);
    if (!result.ok) {
      toast.error("Couldn’t undo this change", { description: result.error });
      return;
    }
    const store = threadStoreRef.current;
    const threadId = threadIdRef.current;
    if (store && threadId && turn?.threadMessageId) {
      const thread = findThread(threadId, store);
      const messages = thread
        ? updateReaderMessageReceipt(
            thread.messages,
            turn.threadMessageId,
            previousReceipt,
            result.receipt
          )
        : null;
      if (messages) replaceMessages(threadId, messages, store);
    }
    setTurns((current) =>
      current.map((turn) =>
        turn.id !== turnId
          ? turn
          : {
              ...turn,
              steps: turn.steps?.map((item, index) =>
                index === stepIndex ? { ...item, receipt: result.receipt } : item
              ),
            }
      )
    );
    toast.success("Agent change undone");
  }

  function persistSuccessfulExchange(
    question: string,
    assistant: {
      content: string;
      citations: AssistantSourceCitation[];
      steps: AgentStep[];
    }
  ): string | undefined {
    const store = threadStoreRef.current;
    if (!doc || !store) return undefined;

    let thread = threadIdRef.current ? findThread(threadIdRef.current, store) : null;
    if (!thread) {
      thread = createThread(undefined, documentThreadScope(doc), store);
      threadIdRef.current = thread.id;
    }

    const userMessage = readerUserMessage(question);
    const assistantMessage = readerAssistantMessage({
      ...assistant,
      documentHref: doc.href,
    });
    const updated = replaceMessages(
      thread.id,
      [...thread.messages, userMessage, assistantMessage],
      store
    );
    return updated ? assistantMessage.id : undefined;
  }

  async function onSend(prompt?: string) {
    const question = (prompt ?? input).trim();
    if (!question || busy) return;
    const activeToken = isMock ? "mock" : webKey;
    if (!activeToken) {
      setError("Add a provider access key first.");
      return;
    }

    setError(null);
    setBusy(true);
    const request = ++requestId.current;
    const nextTurns: Turn[] = [...turns, { id: nextTurnId(), role: "user", content: question }];
    setTurns(nextTurns);
    if (!prompt) setInput("");

    try {
      const fetchImpl: FetchLike = await tauriFetch();
      const provider = createAssistantProvider({
        kind: config.kind,
        token: activeToken,
        model: config.model,
        fetchImpl,
      });

      const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
      const ctxDoc = readAssistantContext(doc?.title);
      const messages = buildMessages(ctxDoc, history, question);
      const ctx = readingToolCtx(
        doc
          ? {
              href: doc.href,
              slug: doc.slug,
              title: ctxDoc.title ?? doc.title,
              body: ctxDoc.body ?? "",
              totalChars: ctxDoc.totalChars,
              includedChars: ctxDoc.includedChars,
              truncated: ctxDoc.truncated,
            }
          : null
      );

      const result = await runAgent(provider, READING_TOOLS, messages, ctx, {
        confirm: (call) =>
          request !== requestId.current
            ? Promise.resolve(false)
            : new Promise<boolean>((resolve) => {
                const nextPending = {
                  preview: pendingWritePreview(call.name, call.args, doc),
                  resolve,
                };
                pendingRef.current = nextPending;
                setPending(nextPending);
              }),
        onStep: () => undefined,
      });
      if (request !== requestId.current) return;
      pendingRef.current = null;
      setPending(null);
      const verifiedSources = parseAssistantSources(
        result.content,
        readAssistantContext(doc?.title)
      );
      const assistantContent = verifiedSources.content || "The Agent returned no readable answer.";
      const threadMessageId = persistSuccessfulExchange(question, {
        content: assistantContent,
        citations: verifiedSources.citations,
        steps: result.steps,
      });
      setTurns([
        ...nextTurns,
        {
          id: nextTurnId(),
          role: "assistant",
          content: assistantContent,
          ...(threadMessageId ? { threadMessageId } : {}),
          steps: result.steps,
          citations: verifiedSources.citations,
          invalidCitationCount: verifiedSources.invalidCitationCount,
        },
      ]);
    } catch (err) {
      if (request !== requestId.current) return;
      const message =
        err instanceof AssistantError || err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      if (request === requestId.current) {
        pendingRef.current = null;
        setPending(null);
        setBusy(false);
      }
    }
  }

  return (
    <section className="rail-panel assistant-panel" aria-label="Agent">
      <div className="assistant-panel-head">
        <span className="assistant-panel-spark">
          <MessageSquareText className="assistant-panel-icon" aria-hidden />
        </span>
        <span className="assistant-panel-title">Agent</span>
        {doc ? <span className="assistant-context-label">This page</span> : null}
        {turns.length > 0 && (
          <button
            type="button"
            className="assistant-panel-clear"
            onClick={() => {
              requestId.current += 1;
              settlePending(false);
              const store = threadStoreRef.current;
              const threadId = threadIdRef.current;
              if (store && threadId) {
                replaceMessages(threadId, [], store);
                renameThread(threadId, "New Chat", store);
              }
              setTurns([]);
              setBusy(false);
              setError(null);
            }}
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        {onCollapse && (
          <button
            type="button"
            className="assistant-panel-collapse"
            onClick={onCollapse}
            aria-label="Collapse chat"
            title="Collapse chat"
          >
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {needsKey ? (
        <ConnectGate configured={config.enabled} documentTitle={doc?.title} />
      ) : (
        <>
          <Transcript
            turns={turns}
            pending={pending}
            busy={busy}
            listRef={listRef}
            onSuggest={(prompt) => void onSend(prompt)}
            onPendingDecision={settlePending}
            contextNote={contextNote}
            onUndo={(turnId, stepIndex) => void undoStep(turnId, stepIndex)}
          />
          {error && <p className="assistant-panel-error">{error}</p>}
          <Composer input={input} busy={busy} onInput={setInput} onSend={onSend} />
        </>
      )}
    </section>
  );
}
