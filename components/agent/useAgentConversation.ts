"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import type { StateStore } from "@/lib/state-store";
import { getAgentReply } from "@/components/agent/agent-replies";
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

export interface AgentConversationFailure {
  threadId: string;
  prompt: string;
  message: string;
}

interface ActiveRequest {
  binding: ThreadBinding;
  threadId: string;
  prompt: string;
  messagesBefore: ThreadMessage[];
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
  const [failure, setFailure] = useState<AgentConversationFailure | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const latestRef = useRef({ activeId, binding });
  latestRef.current = { activeId, binding };
  const messages = activeThread?.messages ?? [];

  const invalidateRequest = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    activeRequestRef.current = null;
    if (mountedRef.current) setSending(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      activeRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    invalidateRequest();
    setFailure(null);
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
    setFailure(null);
    draftRef.current?.focus();
    scrollDown();
  }

  function fillStarterPrompt(prompt: string): boolean {
    if (!activeId || sending || !draftRef.current) return false;
    draftRef.current.value = prompt;
    draftRef.current.focus();
    return true;
  }

  async function handleSend(promptOverride?: string) {
    const bindingRef = binding;
    const threadId = activeId;
    const prompt = (promptOverride ?? draftRef.current?.value ?? "").trim();
    if (!bindingRef || !threadId || !prompt || sending || !isReady || assistantKind === "none") {
      return;
    }

    const messagesBefore = activeThread?.messages ?? [];
    const userMessage: ThreadMessage = { id: bindingRef.api.newId(), role: "user", text: prompt };
    const pendingThread = bindingRef.api.addMessage(threadId, userMessage, bindingRef.state);
    if (!pendingThread) return;

    const request = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    activeRequestRef.current = {
      binding: bindingRef,
      threadId,
      prompt,
      messagesBefore,
    };
    setFailure(null);
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
        scope: activeThread?.scope,
        sources,
        availableSourceCount,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      bindingRef.api.addMessage(threadId, reply, bindingRef.state);
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Agent chat error:", error);
      bindingRef.api.replaceMessages(threadId, messagesBefore, bindingRef.state);
      setFailure({
        threadId,
        prompt,
        message: "The Agent couldn’t complete this request. Restore the prompt or try it again.",
      });
    } finally {
      if (isCurrent()) {
        abortRef.current = null;
        activeRequestRef.current = null;
        setSending(false);
        scrollDown();
      }
    }
  }

  function stopRequest() {
    const request = activeRequestRef.current;
    if (!request || !sending) return;

    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    activeRequestRef.current = null;
    request.binding.api.replaceMessages(
      request.threadId,
      request.messagesBefore,
      request.binding.state
    );
    setFailure({
      threadId: request.threadId,
      prompt: request.prompt,
      message: "The Agent stopped before completing this request.",
    });
    setSending(false);
    scrollDown();
  }

  function restoreFailedPrompt() {
    if (!failure || failure.threadId !== activeId) return;
    if (fillStarterPrompt(failure.prompt)) setFailure(null);
  }

  function retryFailedPrompt() {
    if (!failure || failure.threadId !== activeId) return;
    void handleSend(failure.prompt);
  }

  return {
    streamRef,
    draftRef,
    messages,
    sending,
    failure,
    scrollDown,
    resetConversation,
    fillStarterPrompt,
    handleSend,
    stopRequest,
    restoreFailedPrompt,
    retryFailedPrompt,
    invalidateRequest,
  };
}
