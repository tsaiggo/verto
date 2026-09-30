import type { AgentSource } from "@/components/agent/agent-types";

export interface AgentHandoff {
  source: AgentSource;
  prompt: string;
}

const STORAGE_KEY = "verto:agent-document-handoff";
let current: AgentHandoff | null = null;

function isHandoff(value: unknown): value is AgentHandoff {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AgentHandoff>;
  const source = entry.source;
  return (
    typeof entry.prompt === "string" &&
    !!source &&
    typeof source.title === "string" &&
    typeof source.subtitle === "string" &&
    typeof source.body === "string" &&
    typeof source.href === "string" &&
    /^\/(read|help)(\/|$)/.test(source.href) &&
    !/[\\\u0000-\u001f\u007f]/.test(source.href)
  );
}

/** Keep the current Reader source in this tab, without putting its body in a URL. */
export function setAgentHandoff(handoff: AgentHandoff): void {
  if (!isHandoff(handoff)) return;
  current = handoff;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    // The in-memory handoff still works when browser storage is unavailable.
  }
}

/** Only restore a source for the exact document requested by the Agent route. */
export function getAgentHandoff(href: string | null): AgentHandoff | null {
  if (!href) return null;
  if (current?.source.href === href) return current;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (isHandoff(value) && value.source.href === href) {
      current = value;
      return value;
    }
  } catch {
    // A missing or unreadable handoff never supplies substitute document context.
  }
  return null;
}
