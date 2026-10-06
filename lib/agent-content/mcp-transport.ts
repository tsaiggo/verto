import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  isJSONRPCRequest,
  isJSONRPCResponse,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";

/** Authorize discovery as well as content calls, without caching a session grant. */
export class AuthorizedStdioTransport extends StdioServerTransport {
  private readonly requests = new Map<string | number, string>();
  constructor(private readonly authorize: () => Promise<unknown>) {
    super();
  }

  async start(): Promise<void> {
    const deliver = this.onmessage;
    this.onmessage = (message) => {
      if (!isJSONRPCRequest(message)) {
        deliver?.(message);
        return;
      }
      void this.authorize()
        .then((grant) => {
          this.requests.set(message.id, JSON.stringify(grant));
          deliver?.(message);
        })
        .catch(() =>
          this.send({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32001, message: "Agent access is unavailable or revoked." },
          })
        );
    };
    await super.start();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!isJSONRPCResponse(message)) return super.send(message);
    const before = this.requests.get(message.id);
    this.requests.delete(message.id);
    try {
      const after = JSON.stringify(await this.authorize());
      if (before !== undefined && before !== after) throw new Error("Grant changed");
      await super.send(message);
    } catch {
      await super.send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32001, message: "Agent access is unavailable or revoked." },
      });
    }
  }
}
