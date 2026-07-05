// Multi-step agent loop. Given a provider that can tool-call, a tool set, and a
// running message list, it dispatches tool calls until the model answers or the
// step cap is hit. Mutating tools pause on `confirm` so writes need the reader's
// approval before any localStorage change. Pure of UI; the panel supplies hooks.

import {
  dispatch,
  findTool,
  toolSpecs,
  type AnyToolDef,
  type ToolCtx,
} from "@/lib/ai/tools/registry";
import type { AssistantProvider, ChatMessage, ToolCall } from "@/lib/ai/types";
import { AssistantError } from "@/lib/ai/types";

export interface AgentStep {
  name: string;
  args: string;
  result: string;
  ok: boolean;
}

export interface RunAgentOptions {
  maxSteps?: number;
  signal?: AbortSignal;
  confirm?: (call: { name: string; args: string }) => Promise<boolean>;
  onStep?: (step: AgentStep) => void;
}

export interface AgentResult {
  content: string;
  model: string;
  steps: AgentStep[];
}

export async function runAgent(
  provider: AssistantProvider,
  tools: readonly AnyToolDef[],
  messages: ChatMessage[],
  ctx: ToolCtx,
  opts: RunAgentOptions = {}
): Promise<AgentResult> {
  if (!provider.agentChat) throw new AssistantError("Provider does not support tools.", "no_tools");
  const maxSteps = opts.maxSteps ?? 6;
  const specs = toolSpecs(tools);
  const convo = [...messages];
  const steps: AgentStep[] = [];
  let model = provider.model;

  for (let step = 0; step < maxSteps; step += 1) {
    const reply = await provider.agentChat(convo, specs, { signal: opts.signal });
    model = reply.model;
    if (!reply.toolCalls?.length) return { content: reply.content, model, steps };

    convo.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      const result = await runOne(tools, call, ctx, opts);
      steps.push(result);
      opts.onStep?.(result);
      convo.push({ role: "tool", toolCallId: call.id, content: result.result });
    }
  }

  const final = await provider.chat(
    [...convo, { role: "user", content: "Summarize what you did for me, briefly." }],
    { signal: opts.signal }
  );
  return { content: final.content, model: final.model, steps };
}

async function runOne(
  tools: readonly AnyToolDef[],
  call: ToolCall,
  ctx: ToolCtx,
  opts: RunAgentOptions
): Promise<AgentStep> {
  const def = findTool(tools, call.name);
  if (def?.mutates && opts.confirm) {
    const approved = await opts.confirm({ name: call.name, args: call.args });
    if (!approved)
      return { name: call.name, args: call.args, result: "Reader declined.", ok: false };
  }
  const out = await dispatch(tools, call.name, call.args, ctx);
  return out.ok
    ? { name: call.name, args: call.args, result: out.content, ok: true }
    : { name: call.name, args: call.args, result: out.error, ok: false };
}
