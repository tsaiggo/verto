import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createContentFixture } from "./node-fixture";
import type { ContentCitation } from "./types";
import { vaultDocumentId } from "./identity";

beforeAll(() => {
  execFileSync(process.execPath, [path.resolve("scripts/build-mcp.mjs")], {
    stdio: "pipe",
    timeout: 30000,
  });
});

describe("distributed MCP stdio companion", () => {
  it("does not disclose malformed manifest contents in startup stderr", async () => {
    const fixture = await createContentFixture();
    try {
      await fixture.writeGrant({ ...fixture.grant, documentIds: ["managed:allowed"] });
      await writeFile(fixture.libraryPath, '{"private":"DENIED FIXTURE SECRET malformed');
      const result = spawnSync(
        process.execPath,
        [
          path.resolve("src-tauri/resources/mcp/verto-mcp.mjs"),
          "--access-file",
          fixture.accessFile,
          "--client",
          fixture.grant.id,
        ],
        {
          env: { NODE_ENV: "test", VERTO_MCP_TOKEN: fixture.token },
          encoding: "utf8",
          timeout: 10000,
        }
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("The authorized content is unavailable.\n");
    } finally {
      await fixture.cleanup();
    }
  });
  it("initializes a real SDK client, finds/reads/annotates/resolves, then rejects a revoked session", async () => {
    const fixture = await createContentFixture();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        path.resolve("src-tauri/resources/mcp/verto-mcp.mjs"),
        "--access-file",
        fixture.accessFile,
        "--client",
        fixture.grant.id,
      ],
      env: { NODE_ENV: "test", VERTO_MCP_TOKEN: fixture.token },
      stderr: "pipe",
    });
    const client = new Client({ name: "fixture-reader", version: "1.0.0" });
    const baseline = await readFile(fixture.libraryPath, "utf8");
    try {
      await mkdir(path.join(fixture.vaultRoot, "Research space"));
      await writeFile(
        path.join(fixture.vaultRoot, "Research space", "topic.md"),
        "A quoted vault passage."
      );
      await client.connect(transport);
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
        "list_documents",
        "search_documents",
        "read_document",
        "list_annotations",
        "resolve_citation",
      ]);
      const search = await client.callTool({
        name: "search_documents",
        arguments: { query: "emerald fox" },
      });
      const evidence = search.structuredContent as {
        matches: { citation: ContentCitation; blockIndex: number }[];
      };
      const citation = evidence.matches[0].citation;
      const read = await client.callTool({
        name: "read_document",
        arguments: {
          docId: citation.docId,
          version: citation.version,
          offset: evidence.matches[0].blockIndex,
        },
      });
      expect(JSON.stringify(read.structuredContent)).toContain("emerald fox");
      const notes = await client.callTool({
        name: "list_annotations",
        arguments: { docId: citation.docId },
      });
      expect(JSON.stringify(notes.structuredContent)).toContain("Saved reflection");
      const resolved = await client.callTool({
        name: "resolve_citation",
        arguments: { ...citation },
      });
      expect(resolved.structuredContent).toMatchObject({
        status: "resolved",
        citation: { href: expect.stringContaining("#verto-citation=") },
      });
      expect((await client.readResource({ uri: "verto://documents" })).contents).toHaveLength(1);
      expect(
        (
          await client.readResource({
            uri: `verto://documents/${encodeURIComponent(citation.docId)}`,
          })
        ).contents
      ).toHaveLength(1);
      const vaultId = await vaultDocumentId(fixture.vaultRoot, "Research space/topic.md");
      expect(
        JSON.stringify(
          await client.readResource({ uri: `verto://documents/${encodeURIComponent(vaultId)}` })
        )
      ).toContain("quoted vault passage");
      await fixture.writeGrant({ ...fixture.grant, documentIds: ["managed:allowed"] });
      const denied = await client.callTool({
        name: "read_document",
        arguments: { docId: "managed:denied" },
      });
      expect(denied.isError).toBe(true);
      expect(JSON.stringify(denied)).not.toContain("Forbidden title");
      fixture.articles[0].source += " More evidence.";
      fixture.articles[0].revision++;
      await writeFile(
        fixture.libraryPath,
        JSON.stringify({
          version: 1,
          articles: fixture.articles,
          documents: [],
          books: [],
          assets: [],
        })
      );
      expect(
        (await client.callTool({ name: "resolve_citation", arguments: { ...citation } }))
          .structuredContent
      ).toMatchObject({ status: "stale" });
      await writeFile(fixture.libraryPath, baseline);
      await fixture.writeGrant(null);
      await expect(client.listTools()).rejects.toThrow(/revoked/);
      await expect(client.listResources()).rejects.toThrow(/revoked/);
      await expect(client.readResource({ uri: "verto://documents" })).rejects.toThrow(/revoked/);
      await expect(
        client.callTool({ name: "search_documents", arguments: { query: "emerald" } })
      ).rejects.toThrow(/revoked/);
      expect(await readFile(fixture.libraryPath, "utf8")).toBe(baseline);
    } finally {
      await client.close();
      await fixture.cleanup();
    }
  }, 30000);
});
