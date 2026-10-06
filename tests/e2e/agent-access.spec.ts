import { expect, test, type Page } from "playwright/test";

async function installDesktopFixture(page: Page) {
  await page.addInitScript(() => {
    const manifestPath = "C:/Verto-fixture/agent-access.json";
    const serverPath = "C:/Verto-fixture/mcp/verto-mcp.mjs";
    const managedRoot = "C:/Verto-fixture/content-v1";
    const now = "2026-10-06T00:00:00Z";
    type Grant = {
      id: string;
      name: string;
      managedRoot: string;
      includeDrafts: boolean;
      documentIds?: string[];
      scopes: string[];
      createdAt: string;
    };
    const grants: Grant[] = [];
    const calls: { command: string; args: Record<string, unknown> }[] = [];
    const fixture = window as unknown as {
      __TAURI_INTERNALS__: unknown;
      __TAURI_EVENT_PLUGIN_INTERNALS__: unknown;
      __agentAccessCalls: typeof calls;
    };
    fixture.__agentAccessCalls = calls;
    fixture.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    fixture.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      invoke: async (command: string, args: Record<string, unknown> = {}) => {
        calls.push({ command, args });
        switch (command) {
          case "get_agent_access_manifest_info":
            return {
              manifestPath,
              managedRoot,
              serverPath,
              availableVaultRoot: "C:/Verto-fixture/Notes",
            };
          case "list_agent_access_grants":
            return structuredClone(grants);
          case "create_agent_access_grant": {
            const input = args.input as Omit<Grant, "id" | "managedRoot" | "createdAt">;
            const grant: Grant = { ...input, id: "fixture-client", managedRoot, createdAt: now };
            grants.push(grant);
            return { grant, token: "fixture-once-secret", manifestPath, serverPath };
          }
          case "revoke_agent_access_grant": {
            const index = grants.findIndex((grant) => grant.id === args.id);
            if (index !== -1) grants.splice(index, 1);
            return { revoked: index !== -1 };
          }
          case "list_managed_articles":
            return [
              {
                id: "saved-a",
                title: "Agent research",
                filename: "agent.md",
                source: "# Agent research\n\nSaved evidence.",
                revision: 1,
                status: "saved",
                createdAt: now,
                updatedAt: now,
              },
              {
                id: "draft-b",
                title: "Private draft",
                filename: "draft.md",
                source: "# Private draft",
                revision: 0,
                status: "draft",
                createdAt: now,
                updatedAt: now,
              },
            ];
          case "get_active_local_library":
            return { folder: null, available: false, rendererMatchesActive: true };
          case "read_agent_annotations":
            return { annotations: [] };
          case "plugin:app|version":
            return "0.1.1";
          case "plugin:event|listen":
            return 1;
          default:
            return null;
        }
      },
      transformCallback: () => 1,
      unregisterCallback: () => {},
    };
  });
}

test("browser Settings explains desktop-only access without a grant form", async ({ page }) => {
  await page.goto("/settings/agent");
  const access = page.getByRole("region", { name: "Agent access", exact: true });
  await expect(access).toContainText("available in the Verto desktop app");
  await expect(access.getByRole("button", { name: "Authorize a client" })).toHaveCount(0);
});

test("desktop client authorization retains explicit scope, shows credentials once, and revokes", async ({
  page,
}) => {
  await installDesktopFixture(page);
  await page.goto("/settings/agent");
  const access = page.getByRole("region", { name: "Agent access", exact: true });
  await access.getByRole("button", { name: "Authorize a client" }).click();
  await access.getByRole("textbox", { name: "Client name" }).fill("Codex fixture");
  await access.getByRole("radio", { name: "Selected local documents" }).check();
  await expect(access.getByRole("checkbox", { name: "Private draft" })).toHaveCount(0);
  await expect(access.getByRole("checkbox", { name: /connected Markdown folder/ })).toHaveCount(0);
  await expect(
    access.getByRole("button", { name: "Authorize client", exact: true })
  ).toBeDisabled();
  await access.getByRole("checkbox", { name: "Agent research", exact: true }).check();
  await access
    .getByRole("checkbox", { name: "Include annotations from the current workspace" })
    .check();
  await access.getByRole("button", { name: "Authorize client", exact: true }).click();
  const config = access.getByLabel("MCP client configuration");
  await expect(config).toContainText("fixture-once-secret");
  await expect(config).toContainText('"VERTO_MCP_TOKEN"');
  await expect(config).toContainText("--access-file");
  const parsed = JSON.parse(await config.innerText());
  expect(parsed.mcpServers.verto.args).not.toContain("fixture-once-secret");
  await expect(access).toContainText("Node.js 20.19");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __agentAccessCalls: { command: string; args: unknown }[] }
        ).__agentAccessCalls.find((call) => call.command === "create_agent_access_grant")?.args
    )
  ).toEqual({
    input: {
      name: "Codex fixture",
      documentIds: ["managed:saved-a"],
      includeDrafts: false,
      scopes: ["documents:read", "annotations:read"],
    },
  });
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((value) => value.includes("fixture-once-secret"))
    )
  ).toBe(false);
  await access.getByRole("button", { name: "Dismiss client credentials" }).click();
  await expect(config).toHaveCount(0);
  await access.getByRole("button", { name: "Revoke Codex fixture" }).click();
  await expect(access).toContainText("No external clients have access");
  await expect(access.getByText("Codex fixture", { exact: true })).toHaveCount(0);
});

test.describe("Agent access responsive layout", () => {
  for (const width of [390, 1280]) {
    test(`keeps authorization and connection configuration within ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installDesktopFixture(page);
      await page.goto("/settings/agent");
      const access = page.getByRole("region", { name: "Agent access", exact: true });
      await access.getByRole("button", { name: "Authorize a client" }).click();
      await access.getByRole("textbox", { name: "Client name" }).fill("Layout fixture");
      await access.getByRole("button", { name: "Authorize client", exact: true }).click();
      await expect(access.getByLabel("MCP client configuration")).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
      await page.screenshot({ path: `test-results/agent-access-${width}.png`, fullPage: true });
    });
  }
});
