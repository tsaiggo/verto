"use client";

// Right-rail AI assistant panel.
//
// The reading companion uses the configured model backend and a manually saved
// access key. The key stays in localStorage on both web and desktop builds.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, PanelRightClose, Sparkles, Trash2, User, X } from "lucide-react";
import { AssistantWelcome } from "@/components/assistant/AssistantWelcome";
import { PendingWriteCard } from "@/components/assistant/PendingWriteCard";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SummaryDocRef } from "@/lib/summaries";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
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

function ConnectGate() {
  return (
    <p className="assistant-panel-hint">
      Add an assistant key in{" "}
      <Link className="assistant-panel-link" href="/settings/agent">
        Settings
      </Link>{" "}
      to enable the reading companion.
    </p>
  );
}

function AccountAvatar() {
  return (
    <span className="assistant-avatar assistant-avatar-guest" aria-hidden>
      <User />
    </span>
  );
}
function TurnSteps({ turn }: { turn: Turn }) {
  if (!turn.steps || turn.steps.length === 0) return null;
  return (
    <ul className="assistant-steps">
      {turn.steps.map((step, i) => (
        <li
          key={`${turn.id}-${i}`}
          className={`assistant-step${step.ok ? "" : " assistant-step-fail"}`}
        >
          {step.ok ? <Check className="assistant-step-tick" aria-hidden /> : <X aria-hidden />}
          {WRITE_LABELS[step.name] ?? step.name.replace(/_/g, " ")}
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
}: {
  turns: Turn[];
  pending: PendingWrite | null;
  busy: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onSuggest: (prompt: string) => void;
  onPendingDecision: (approved: boolean) => void;
  contextNote: string;
}) {
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
                  <Sparkles className="assistant-kicker-spark" aria-hidden />
                  Companion
                </div>
                <TurnSteps turn={turn} />
                <div className="assistant-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                </div>
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
              <Sparkles className="assistant-kicker-spark" aria-hidden />
              Companion
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
          placeholder="Ask your reading companion…"
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

  function settlePending(approved: boolean) {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(approved && current.preview.valid);
  }

  useEffect(() => {
    const invalidate = () => {
      requestId.current += 1;
      settlePending(false);
      setTurns([]);
      setInput("");
      setBusy(false);
      setError(null);
      setContextNote(describeDocContextScope(readDocContextFromDom()));
    };
    invalidate();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, invalidate);
    return () => {
      requestId.current += 1;
      settlePending(false);
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, invalidate);
    };
  }, [doc?.href]);

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

  if (!config.enabled) return null;

  const isMock = config.kind === "mock";
  const token = isMock ? "mock" : webKey;
  const needsKey = !isMock && !token;

  async function onSend(prompt?: string) {
    const question = (prompt ?? input).trim();
    if (!question || busy) return;
    const activeToken = isMock ? "mock" : webKey;
    if (!activeToken) {
      setError("Connect the assistant first.");
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
      const ctxDoc = readDocContextFromDom();
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
      setTurns([
        ...nextTurns,
        { id: nextTurnId(), role: "assistant", content: result.content, steps: result.steps },
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
    <section className="rail-panel assistant-panel" aria-label="Reading companion">
      <div className="assistant-panel-head">
        <span className="assistant-panel-spark">
          <Sparkles className="assistant-panel-icon" aria-hidden />
        </span>
        <span className="assistant-panel-title">Reading companion</span>
        {turns.length > 0 && (
          <button
            type="button"
            className="assistant-panel-clear"
            onClick={() => {
              requestId.current += 1;
              settlePending(false);
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
        <ConnectGate />
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
          />
          {error && <p className="assistant-panel-error">{error}</p>}
          <Composer input={input} busy={busy} onInput={setInput} onSend={onSend} />
        </>
      )}
    </section>
  );
}
