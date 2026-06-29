export const ASK_AI_EVENT = "verto:ask-ai";

export function dispatchAskAI(quote: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, { detail: { quote } }));
}
