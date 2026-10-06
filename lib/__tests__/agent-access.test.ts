import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentAccessClientConfig,
  createAgentAccessGrant,
  describeAgentAccessScope,
  type CreatedAgentAccessGrant,
} from "@/lib/agent-access";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tauri", () => ({ isTauri: () => true, tauriInvoke: invoke }));

const created: CreatedAgentAccessGrant = {
  grant: {
    id: "client-1",
    name: "Codex",
    managedRoot: "C:/data/content-v1",
    documentIds: ["managed:a"],
    includeDrafts: false,
    scopes: ["documents:read"],
    createdAt: "2026-10-06T00:00:00Z",
  },
  token: "once-secret",
  manifestPath: "C:/data/agent-access.json",
  serverPath: "C:/Verto/resources/mcp/verto-mcp.mjs",
};

describe("Agent access facade", () => {
  beforeEach(() => invoke.mockReset());
  it("rejects an empty explicit selection rather than widening it to Library", async () => {
    await expect(createAgentAccessGrant({ name: "Codex", documentIds: [] })).rejects.toThrow(
      "Select at least one document"
    );
    expect(invoke).not.toHaveBeenCalled();
  });
  it("preserves explicit scopes and deduplicates selected document IDs", async () => {
    invoke.mockResolvedValue(created);
    await createAgentAccessGrant({
      name: " Codex ",
      documentIds: ["managed:a", "managed:a"],
      scopes: ["documents:read"],
    });
    expect(invoke).toHaveBeenCalledWith("create_agent_access_grant", {
      input: { name: "Codex", documentIds: ["managed:a"], scopes: ["documents:read"] },
    });
  });
  it("keeps credentials out of process arguments", () => {
    const config = JSON.parse(agentAccessClientConfig(created)).mcpServers.verto;
    expect(config.command).toBe("node");
    expect(config.args).toEqual([
      created.serverPath,
      "--access-file",
      created.manifestPath,
      "--client",
      created.grant.id,
    ]);
    expect(config.args.join(" ")).not.toContain(created.token);
    expect(config.env).toEqual({ VERTO_MCP_TOKEN: created.token });
  });
  it("describes annotation and draft access independently", () => {
    expect(describeAgentAccessScope(created.grant)).toBe("1 selected local document");
    expect(
      describeAgentAccessScope({
        ...created.grant,
        documentIds: undefined,
        includeDrafts: true,
        scopes: ["documents:read", "annotations:read"],
      })
    ).toBe("Saved local Library · drafts included · annotations included");
    expect(
      describeAgentAccessScope({
        ...created.grant,
        annotationRoot: "C:/notes",
        scopes: ["documents:read", "annotations:read"],
      })
    ).toBe("1 selected local document · annotations from original workspace");
  });
});
