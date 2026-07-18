"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { agentReply, getAgentReply } from "@/components/agent/agent-replies";
import { persistThreadMessage, type ThreadBinding } from "@/components/agent/agent-persistence";
import { AssistantError } from "@/lib/ai";
import type {
  AgentSource,
  AssistantKind,
  ThreadData,
  ThreadMessage,
} from "@/components/agent/agent-types";

export type { ThreadBinding } from "@/components/agent/agent-persistence";

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

export function agentFailureMessage(error: unknown): string {
  if (error instanceof AssistantError) {
    if (error.status === 401 || error.status === 403 || error.code === "no_token") {
      return "The assistant key was rejected. Review AI & Agent settings, update the key, then send this request again.";
    }
    if (error.status === 429 || error.code === "rate_limited") {
      return "The assistant provider is rate limiting requests. Wait a moment, then send this request again.";
    }
    if (typeof error.status === "number" && error.status >= 500) {
      return "The assistant provider is temporarily unavailable. Your message is saved; try sending it again shortly.";
    }
    if (error.code === "network" || error.code === "request_failed") {
      return "Verto could not reach the assistant provider. Check your connection, then send this request again.";
    }
  }

  if (error instanceof TypeError) {
    return "Verto could not reach the assistant provider. Check your connection, then send this request again.";
  }

  return "The assistant could not finish this request. Your message is saved, so you can send it again.";
}

interface SendPreparationOptions {
  binding: ThreadBinding | null;
  activeId: string | null;
  prompt: string | undefined;
  sending: boolean;
  isReady: boolean;
  assistantKind: AssistantKind;
}

interface SendPreparation {
  binding: ThreadBinding;
  threadId: string;
  prompt: string;
  assistantKind: Exclude<AssistantKind, "none">;
}

function prepareSend(options: SendPreparationOptions): SendPreparation | null {
  const { binding, activeId, prompt, sending, isReady, assistantKind } = options;
  if (!binding || !activeId || !prompt || sending || !isReady || assistantKind === "none") {
    return null;
  }
  return { binding, threadId: activeId, prompt, assistantKind };
}

function isCurrentAgentRequest(
  mounted: boolean,
  request: number,
  currentRequest: number,
  latest: { activeId: string | null; binding: ThreadBinding | null },
  binding: ThreadBinding,
  threadId: string
): boolean {
  return (
    mounted &&
    request === currentRequest &&
    latest.binding === binding &&
    latest.binding?.generation === binding.generation &&
    latest.activeId === threadId
  );
}

interface ResolveReplyOptions {
  assistantKind: Exclude<AssistantKind, "none">;
  assistantModel: string;
  binding: ThreadBinding;
  pendingThread: ThreadData;
  sources: AgentSource[];
  availableSourceCount: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
}

async function resolveAgentReply(options: ResolveReplyOptions): Promise<ThreadMessage | null> {
  try {
    return await getAgentReply({
      kind: options.assistantKind,
      model: options.assistantModel,
      store: options.binding.api,
      messages: options.pendingThread.messages,
      sources: options.sources,
      availableSourceCount: options.availableSourceCount,
      signal: options.signal,
    });
  } catch (error) {
    if (!options.isCurrent()) return null;
    console.error("Agent chat error:", error);
    return agentReply(options.binding.api, agentFailureMessage(error));
  }
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

  const fillStarterPrompt = useCallback(
    (prompt: string): boolean => {
      const nextPrompt = prompt.trim();
      if (!activeId || sending || !nextPrompt || !draftRef.current) return false;
      draftRef.current.value = nextPrompt;
      draftRef.current.focus();
      return true;
    },
    [activeId, sending]
  );

  async function handleSend() {
    const prepared = prepareSend({
      binding,
      activeId,
      prompt: draftRef.current?.value?.trim(),
      sending,
      isReady,
      assistantKind,
    });
    if (!prepared) return;
    const { binding: bindingRef, threadId, prompt, assistantKind: readyKind } = prepared;

    const userMessage: ThreadMessage = { id: bindingRef.api.newId(), role: "user", text: prompt };
    const userPersistence = persistThreadMessage(bindingRef, threadId, userMessage);
    if (userPersistence.status === "failed") {
      toast.error("Couldn't save message", {
        description:
          "Your message is still in the composer. Check local storage, then try sending again.",
      });
      return;
    }
    if (userPersistence.status === "missing") {
      toast.error("Couldn't save message", {
        description: "The conversation changed. Select a conversation, then try sending again.",
      });
      return;
    }

    const request = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    if (draftRef.current) draftRef.current.value = "";
    scrollDown();

    const isCurrent = () =>
      isCurrentAgentRequest(
        mountedRef.current,
        request,
        requestRef.current,
        latestRef.current,
        bindingRef,
        threadId
      );

    try {
      const reply = await resolveAgentReply({
        assistantKind: readyKind,
        assistantModel,
        binding: bindingRef,
        pendingThread: userPersistence.thread,
        sources,
        availableSourceCount,
        signal: controller.signal,
        isCurrent,
      });
      if (!reply || !isCurrent()) return;

      const replyPersistence = persistThreadMessage(bindingRef, threadId, reply);
      const replyPersisted =
        replyPersistence.status === "persisted" &&
        replyPersistence.thread.messages.some((message) => message.id === reply.id);
      if (!replyPersisted) {
        toast.error("Couldn't save Agent response", {
          description:
            "The response could not be added to this conversation. Check local storage, then retry the request.",
        });
      }
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
