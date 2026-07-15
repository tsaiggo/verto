// Client-side tool registry for the agentic reading companion. Each tool is a
// typed definition the model can call: a JSON-Schema spec it advertises plus a
// `run` that executes against in-browser state. Read tools run inline; tools
// flagged `mutates` persist localStorage and must be confirmed by the panel.

import type { ToolSpec } from "@/lib/ai/types";

export interface ToolCtx {
  doc: {
    href: string;
    slug: string[];
    title: string;
    body: string;
    totalChars?: number;
    includedChars?: number;
    truncated?: boolean;
  } | null;
  workspace?: WorkspaceSource[];
}

/** A readable source exposed to the workspace Agent's retrieval tools. */
export interface WorkspaceSource {
  href: string;
  title: string;
  body: string;
  tags?: string[];
}

export type ToolResult = { ok: true; content: string } | { ok: false; error: string };

export interface ToolDef<A> {
  name: string;
  description: string;
  mutates: boolean;
  parameters: Record<string, unknown>;
  parse(raw: string): A;
  run(args: A, ctx: ToolCtx): Promise<ToolResult>;
}

export type AnyToolDef = ToolDef<unknown>;

export function toolSpecs(defs: readonly AnyToolDef[]): ToolSpec[] {
  return defs.map((d) => ({ name: d.name, description: d.description, parameters: d.parameters }));
}

export function findTool(defs: readonly AnyToolDef[], name: string): AnyToolDef | undefined {
  return defs.find((d) => d.name === name);
}

export async function dispatch(
  defs: readonly AnyToolDef[],
  name: string,
  rawArgs: string,
  ctx: ToolCtx
): Promise<ToolResult> {
  const def = findTool(defs, name);
  if (!def) return { ok: false, error: `Unknown tool: ${name}` };
  let args: unknown;
  try {
    args = def.parse(rawArgs);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `Bad arguments for ${name}` };
  }
  try {
    return await def.run(args, ctx);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `Tool ${name} failed` };
  }
}

export function parseObject(raw: string): Record<string, unknown> {
  const value: unknown = raw.trim() === "" ? {} : JSON.parse(raw);
  if (typeof value !== "object" || value === null) throw new Error("Arguments must be an object");
  return value as Record<string, unknown>;
}

export function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`Missing "${key}"`);
  return v;
}

export function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}
