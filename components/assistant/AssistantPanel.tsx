"use client";

// Right-rail AI assistant panel.
//
// Renders a compact chat panel that answers questions about the document the
// reader is currently viewing, powered by the GitHub Copilot / GitHub Models
// backend (see `lib/ai`). It follows the same runtime-aware pattern as the rest
// of Verto's desktop features:
//
//   • Disabled entirely unless `NEXT_PUBLIC_VERTO_ASSISTANT` is configured.
//   • On the desktop app it reuses the signed-in GitHub token and the Tauri
//     HTTP plugin (to bypass CORS).
//   • In the browser it falls back to a user-supplied key kept only in
//     localStorage; the key is never written to the repository.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Compass,
  Lightbulb,
  PanelRightClose,
  Send,
  Sparkles,
  Trash2,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTauri, tauriFetch, type FetchLike } from "@/lib/tauri";
import {
  createAssistantProvider,
  getAssistantConfig,
  AssistantError,
  type ChatMessage,
} from "@/lib/ai";
import { buildMessages, readDocContextFromDom } from "@/lib/ai/context";
import { runAgent, type AgentStep } from "@/lib/ai/agent";
import { READING_TOOLS, readingToolCtx } from "@/lib/ai/tools/library";
import { loadWebKey } from "@/lib/ai/key-store";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
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
  name: string;
  args: string;
  resolve: (approved: boolean) => void;
}

const WRITE_LABELS: Record<string, string> = {
  create_highlight_note: "Save a highlight & note",
  save_summary: "Save a summary to your library",
};

let turnSeq = 0;
const nextTurnId = () => ++turnSeq;

// Starter prompts for the empty agent state. Each row sends immediately on tap,
// mirroring the OpenAI Docs-agent panel (heading + tappable suggestions).
const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  {
    icon: AlignLeft,
    label: "Summarize this page",
    prompt: "Summarize this page in a few concise bullet points.",
  },
  {
    icon: Lightbulb,
    label: "Explain the key ideas",
    prompt: "Explain the key ideas on this page in plain language.",
  },
  {
    icon: Compass,
    label: "Suggest what to read next",
    prompt: "Based on this page, what should I read next?",
  },
];

function AssistantWelcome({
  onPick,
  busy,
}: {
  onPick: (prompt: string) => void;
  busy: boolean;
}) {
  return (
    <div className="assistant-welcome">
      <p className="assistant-welcome-h">What can I help you with?</p>
      {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          type="button"
          className="assistant-suggest"
          onClick={() => onPick(prompt)}
          disabled={busy}
        >
          <span className="assistant-suggest-icon" aria-hidden>
            <Icon className="h-[17px] w-[17px]" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

function ConnectGate({ desktop }: { desktop: boolean }) {
  return (
    <p className="assistant-panel-hint">
      {desktop
        ? "Sign in with GitHub to read this document with an agent companion."
        : "Add a GitHub Models key in "}
      {!desktop && (
        <a className="assistant-panel-link" href="/integrations">
          Integrations
        </a>
      )}
      {!desktop && " to enable the assistant."}
    </p>
  );
}

function TurnSteps({ turn }: { turn: Turn }) {
  if (!turn.steps || turn.steps.length === 0) return null;
  return (
    <ul className="assistant-steps">
      {turn.steps.map((step, i) => (
        <li key={`${turn.id}-${i}`} className={`assistant-step${step.ok ? "" : " assistant-step-fail"}`}>
          <Wrench className="h-3 w-3" aria-hidden />
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
}: {
  turns: Turn[];
  pending: PendingWrite | null;
  busy: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onSuggest: (prompt: string) => void;
}) {
  return (
    <div className="assistant-panel-transcript" ref={listRef} aria-live="polite">
      {turns.length === 0 ? (
        <AssistantWelcome onPick={onSuggest} busy={busy} />
      ) : (
        turns.map((turn) => (
          <div key={turn.id} className={`assistant-row assistant-row-${turn.role}`}>
            <span className={`assistant-avatar assistant-avatar-${turn.role}`} aria-hidden>
              {turn.role === "assistant" ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </span>
            <div className={`assistant-msg assistant-msg-${turn.role}`}>
              <TurnSteps turn={turn} />
              {turn.role === "assistant" ? (
                <div className="assistant-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                </div>
              ) : (
                turn.content
              )}
            </div>
          </div>
        ))
      )}
      {pending && (
        <div className="assistant-proposal" role="alertdialog" aria-label="Confirm action">
          <span className="assistant-proposal-text">{WRITE_LABELS[pending.name] ?? pending.name}?</span>
          <div className="assistant-proposal-actions">
            <button type="button" className="assistant-panel-send" onClick={() => pending.resolve(true)}>
              Approve
            </button>
            <button type="button" className="assistant-panel-prompt" onClick={() => pending.resolve(false)}>
              Decline
            </button>
          </div>
        </div>
      )}
      {busy && !pending && (
        <div className="assistant-row assistant-row-assistant">
          <span className="assistant-avatar assistant-avatar-assistant" aria-hidden>
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="assistant-msg assistant-msg-assistant assistant-msg-pending">
            <span className="assistant-dots" aria-label="Thinking">
              <span /><span /><span />
            </span>
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
    <>
      <div className="assistant-panel-compose">
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
        <button
          type="button"
          className="assistant-panel-send"
          onClick={() => void onSend()}
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </button>
      </div>
    </>
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
  const { available: desktop, token: desktopToken } = useAuth();

  const [webKey, setWebKey] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isTauri()) return;
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

  const token = desktop ? desktopToken : webKey;
  const isMock = config.kind === "mock";
  const needsKey = !isMock && !token;

  async function onSend(prompt?: string) {
    const question = (prompt ?? input).trim();
    if (!question || busy) return;
    const activeToken = isMock ? "mock" : desktop ? desktopToken : webKey;
    if (!activeToken) {
      setError("Connect the assistant first.");
      return;
    }

    setError(null);
    setBusy(true);
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
        doc ? { href: doc.href, slug: doc.slug, title: ctxDoc.title ?? doc.title, body: ctxDoc.body ?? "" } : null
      );

      const result = await runAgent(provider, READING_TOOLS, messages, ctx, {
        confirm: (call) =>
          new Promise<boolean>((resolve) => setPending({ name: call.name, args: call.args, resolve })),
        onStep: () => undefined,
      });
      setPending(null);
      setTurns([...nextTurns, { id: nextTurnId(), role: "assistant", content: result.content, steps: result.steps }]);
    } catch (err) {
      const message = err instanceof AssistantError || err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setPending(null);
      setBusy(false);
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
              setTurns([]);
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
        <ConnectGate desktop={desktop} />
      ) : (
        <>
          <Transcript
            turns={turns}
            pending={pending}
            busy={busy}
            listRef={listRef}
            onSuggest={(prompt) => void onSend(prompt)}
          />
          {error && <p className="assistant-panel-error">{error}</p>}
          <Composer input={input} busy={busy} onInput={setInput} onSend={onSend} />
        </>
      )}
    </section>
  );
}
