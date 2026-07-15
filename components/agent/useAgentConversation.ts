"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import type { StateStore } from "@/lib/state-store";
import { agentReply, getAgentReply } from "@/components/agent/agent-replies";
import type {
  AgentSource,
  AssistantKind,
  ThreadData,
  ThreadMessage,
  ThreadStore,
} from "@/components/agent/agent-types";

export interface ThreadBinding {
  api: ThreadStore;
  state: StateStore;
  generation: number;
}

interface ConversationOptions {
  assistantKind: AssistantKind;
  assistantModel: string;
  isReady: boolean;
  sources: AgentSource[];
  availableSourceCount: number;
  activeId: string | null;
  activeThread: ThreadData | null;
  binding: ThreadBinding | null;
}

export function useAgentConversation({
  assistantKind,
  assistantModel,
  isReady,
  sources,
  availableSourceCount,
  activeId,
  activeThread,
  binding,
}: ConversationOptions) {
  const streamRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef({ activeId, binding });
  latestRef.current = { activeId, binding };
  const messages = activeThread?.messages ?? [];

  const invalidateRequest = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (mountedRef.current) setSending(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    invalidateRequest();
  }, [activeId, binding, invalidateRequest]);

  useEffect(() => {
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, invalidateRequest);
    return () => window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, invalidateRequest);
  }, [invalidateRequest]);

  function scrollDown() {
    requestAnimationFrame(() => {
      streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function resetConversation() {
    draftRef.current?.focus();
    scrollDown();
  }

  function fillStarterPrompt(prompt: string) {
    if (!activeId || sending || !draftRef.current) return;
    draftRef.current.value = prompt;
    draftRef.current.focus();
  }

  async function handleSend() {
    const bindingRef = binding;
    const threadId = activeId;
    const prompt = draftRef.current?.value?.trim();
    if (!bindingRef || !threadId || !prompt || sending || !isReady || assistantKind === "none") {
      return;
    }

    const userMessage: ThreadMessage = { id: bindingRef.api.newId(), role: "user", text: prompt };
    const pendingThread = bindingRef.api.addMessage(threadId, userMessage, bindingRef.state);
    if (!pendingThread) return;

    const request = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    if (draftRef.current) draftRef.current.value = "";
    scrollDown();

    const isCurrent = () => {
      const latest = latestRef.current;
      return (
        mountedRef.current &&
        request === requestRef.current &&
        latest.binding === bindingRef &&
        latest.binding?.generation === bindingRef.generation &&
        latest.activeId === threadId
      );
    };

    try {
      const reply = await getAgentReply({
        kind: assistantKind,
        model: assistantModel,
        store: bindingRef.api,
        messages: pendingThread.messages,
        sources,
        availableSourceCount,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      bindingRef.api.addMessage(threadId, reply, bindingRef.state);
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Agent chat error:", error);
      const message = agentReply(
        bindingRef.api,
        "Sorry, something went wrong while processing your request."
      );
      bindingRef.api.addMessage(threadId, message, bindingRef.state);
    } finally {
      if (isCurrent()) {
        abortRef.current = null;
        setSending(false);
        scrollDown();
      }
    }
  }

  return {
    streamRef,
    draftRef,
    messages,
    sending,
    scrollDown,
    resetConversation,
    fillStarterPrompt,
    handleSend,
    invalidateRequest,
  };
}
