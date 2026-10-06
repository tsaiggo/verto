import { isTauri, tauriInvoke } from "./tauri";

/** Public grant metadata. Credentials are returned only when a grant is created. */
export interface AgentAccessGrant {
  id: string;
  name: string;
  managedRoot: string;
  vaultRoot?: string | null;
  /** Annotation workspace is separate from permission to read its document bodies. */
  annotationRoot?: string | null;
  documentIds?: string[] | null;
  includeDrafts: boolean;
  scopes: Array<"documents:read" | "annotations:read">;
  createdAt: string;
}

export interface AgentAccessManifestInfo {
  manifestPath: string;
  managedRoot: string;
  availableVaultRoot?: string | null;
  serverPath: string;
}

export interface AgentAccessInput {
  name: string;
  documentIds?: string[];
  includeDrafts?: boolean;
  vaultRoot?: string;
  scopes?: Array<"documents:read" | "annotations:read">;
}

export interface CreatedAgentAccessGrant {
  grant: AgentAccessGrant;
  token: string;
  manifestPath: string;
  serverPath: string;
}

export function agentAccessAvailable(): boolean {
  return isTauri();
}

export function getAgentAccessManifestInfo(): Promise<AgentAccessManifestInfo> {
  return tauriInvoke<AgentAccessManifestInfo>("get_agent_access_manifest_info");
}

export function listAgentAccessGrants(): Promise<AgentAccessGrant[]> {
  return tauriInvoke<AgentAccessGrant[]>("list_agent_access_grants");
}

export function createAgentAccessGrant(input: AgentAccessInput): Promise<CreatedAgentAccessGrant> {
  const name = input.name.trim();
  if (!name || name.length > 80) {
    return Promise.reject(new Error("Use a client name between 1 and 80 characters."));
  }
  if (input.documentIds && input.documentIds.length === 0) {
    return Promise.reject(new Error("Select at least one document."));
  }
  return tauriInvoke<CreatedAgentAccessGrant>("create_agent_access_grant", {
    input: {
      ...input,
      name,
      ...(input.documentIds ? { documentIds: [...new Set(input.documentIds)] } : {}),
    },
  });
}

export function revokeAgentAccessGrant(id: string): Promise<{ revoked: boolean }> {
  return tauriInvoke<{ revoked: boolean }>("revoke_agent_access_grant", { id });
}

/** Displayed once; callers must not persist or log the returned configuration. */
export function agentAccessClientConfig(created: CreatedAgentAccessGrant): string {
  return JSON.stringify(
    {
      mcpServers: {
        verto: {
          command: "node",
          args: [
            created.serverPath,
            "--access-file",
            created.manifestPath,
            "--client",
            created.grant.id,
          ],
          env: {
            VERTO_MCP_TOKEN: created.token,
          },
        },
      },
    },
    null,
    2
  );
}

export function describeAgentAccessScope(grant: AgentAccessGrant): string {
  const documents = grant.documentIds?.length
    ? `${grant.documentIds.length} selected local document${grant.documentIds.length === 1 ? "" : "s"}`
    : "Saved local Library";
  return [
    documents,
    grant.vaultRoot ? "connected folder" : null,
    grant.includeDrafts ? "drafts included" : null,
    grant.scopes.includes("annotations:read")
      ? grant.annotationRoot
        ? "annotations from original workspace"
        : "annotations included"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
