import { describe, expect, it } from "vitest";
import { AssistantError } from "@/lib/ai";
import { agentFailureMessage } from "@/components/agent/useAgentConversation";

describe("agentFailureMessage", () => {
  it("keeps provider failures specific and recoverable", () => {
    expect(
      agentFailureMessage(new AssistantError("unauthorized", "request_failed", 401))
    ).toContain("key was rejected");
    expect(agentFailureMessage(new AssistantError("slow down", "rate_limited", 429))).toContain(
      "rate limiting"
    );
    expect(agentFailureMessage(new AssistantError("down", "request_failed", 503))).toContain(
      "temporarily unavailable"
    );
    expect(agentFailureMessage(new TypeError("fetch failed"))).toContain("could not reach");
  });
});
