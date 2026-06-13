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
import { Send, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTauri, tauriFetch, type FetchLike } from "@/lib/tauri";
import {
  createAssistantProvider,
  getAssistantConfig,
  AssistantError,
  type ChatMessage,
} from "@/lib/ai";
import { buildMessages, readDocContextFromDom } from "@/lib/ai/context";
import { clearWebKey, loadWebKey, saveWebKey } from "@/lib/ai/key-store";
import { READING_COMPANION_PROMPTS } from "@/lib/ai/reading-companion";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
}

let turnSeq = 0;
const nextTurnId = () => ++turnSeq;

export default function AssistantPanel() {
  const config = useMemo(() => getAssistantConfig(), []);
  const { available: desktop, token: desktopToken } = useAuth();

  const [webKey, setWebKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the web fallback key on mount (browser only).
  useEffect(() => {
    if (!isTauri()) setWebKey(loadWebKey());
  }, []);

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);

  // Disabled at build time — render nothing so the bundle/UI is unaffected.
  if (!config.enabled) return null;

  const token = desktop ? desktopToken : webKey;
  const needsKey = !token;

  async function onSend(prompt?: string) {
    const question = (prompt ?? input).trim();
    if (!question || busy) return;
    const activeToken = desktop ? desktopToken : webKey;
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

      const history: ChatMessage[] = turns.map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const ctx = readDocContextFromDom();
      const messages = buildMessages(ctx, history, question);

      const result = await provider.chat(messages);
      setTurns([...nextTurns, { id: nextTurnId(), role: "assistant", content: result.content }]);
    } catch (err) {
      const message =
        err instanceof AssistantError || err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function onSaveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    saveWebKey(trimmed);
    setWebKey(trimmed);
    setKeyInput("");
    setError(null);
  }

  function onDisconnectKey() {
    clearWebKey();
    setWebKey(null);
  }

  return (
    <section className="rail-panel assistant-panel" aria-label="Reading companion">
      <div className="assistant-panel-head">
        <Sparkles className="assistant-panel-icon" aria-hidden />
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
      </div>

      {needsKey ? (
        desktop ? (
          <p className="assistant-panel-hint">
            Sign in with GitHub to read this document with an agent companion.
          </p>
        ) : (
          <div className="assistant-panel-connect">
            <p className="assistant-panel-hint">
              Paste a GitHub token with Models access to enable the assistant. It is stored only in
              this browser.
            </p>
            <input
              type="password"
              className="assistant-panel-input"
              placeholder="github_pat_… or ghp_…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveKey();
              }}
              aria-label="GitHub token"
            />
            <button
              type="button"
              className="assistant-panel-send"
              onClick={onSaveKey}
              disabled={!keyInput.trim()}
            >
              Save key
            </button>
          </div>
        )
      ) : (
        <>
          <div className="assistant-panel-transcript" ref={listRef} aria-live="polite">
            {turns.length === 0 ? (
              <p className="assistant-panel-empty">
                Ask for help understanding, extracting, or connecting this document.
              </p>
            ) : (
              turns.map((turn) => (
                <div key={turn.id} className={`assistant-msg assistant-msg-${turn.role}`}>
                  {turn.content}
                </div>
              ))
            )}
            {busy && (
              <div className="assistant-msg assistant-msg-assistant assistant-msg-pending">
                Thinking…
              </div>
            )}
          </div>

          {error && <p className="assistant-panel-error">{error}</p>}

          <div
            className="assistant-panel-prompts"
            role="group"
            aria-label="Reading companion prompts"
          >
            {READING_COMPANION_PROMPTS.map((quickPrompt) => (
              <button
                key={quickPrompt.label}
                type="button"
                className="assistant-panel-prompt"
                onClick={() => void onSend(quickPrompt.prompt)}
                disabled={busy}
              >
                {quickPrompt.label}
              </button>
            ))}
          </div>

          <div className="assistant-panel-compose">
            <textarea
              className="assistant-panel-input"
              placeholder="Ask your reading companion…"
              value={input}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
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

          {!desktop && (
            <button type="button" className="assistant-panel-disconnect" onClick={onDisconnectKey}>
              Disconnect key
            </button>
          )}
        </>
      )}
    </section>
  );
}
