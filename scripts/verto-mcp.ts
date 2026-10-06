import { AuthorizedStdioTransport } from "../lib/agent-content/mcp-transport";
import { createNodeRepository } from "../lib/agent-content/node-repository";
import { createContentService } from "../lib/agent-content/service";
import { createVertoMcpServer } from "../lib/agent-content/mcp-server";
import { readAgentGrant } from "../lib/agent-content/node-access";
import { ContentAccessError } from "../lib/agent-content/types";

class McpSetupError extends Error {}

function option(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 19))
    throw new McpSetupError("Verto MCP requires Node.js 20.19 or newer.");
  const accessFile = option("--access-file");
  const clientId = option("--client");
  const token = process.env.VERTO_MCP_TOKEN;
  if (!accessFile || !clientId || !token)
    throw new McpSetupError(
      "Provide --access-file, --client and VERTO_MCP_TOKEN from Verto's Agent access settings."
    );
  const options = { accessFile, clientId, token };
  const service = createContentService(createNodeRepository(options));
  await service.listDocuments({ limit: 1 });
  await createVertoMcpServer(service).connect(
    new AuthorizedStdioTransport(() => readAgentGrant(options))
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof McpSetupError || error instanceof ContentAccessError
      ? error.message
      : "The authorized content is unavailable.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
