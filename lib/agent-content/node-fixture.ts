import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import type { AgentGrant } from "./node-access";

export async function createContentFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "verto-agent-fixture-"));
  const managedRoot = path.join(directory, "content-v1");
  const vaultRoot = path.join(directory, "vault");
  await mkdir(managedRoot);
  await mkdir(vaultRoot);
  await mkdir(path.join(vaultRoot, ".verto"));
  const articles = [
    {
      id: "allowed",
      filename: "evidence.md",
      title: "Evidence",
      source: "# Evidence\n\nThe emerald fox gathers knowledge.",
      revision: 3,
      status: "saved",
      createdAt: "now",
      updatedAt: "now",
    },
    {
      id: "denied",
      filename: "secret.md",
      title: "Forbidden title",
      source: "A classified comet.",
      revision: 1,
      status: "saved",
      createdAt: "now",
      updatedAt: "now",
    },
    {
      id: "draft",
      filename: "draft.md",
      source: "An unfinished thought.",
      revision: 1,
      status: "draft",
      createdAt: "now",
      updatedAt: "now",
    },
  ];
  const libraryPath = path.join(managedRoot, "library.json");
  await writeFile(
    libraryPath,
    JSON.stringify({ version: 1, articles, documents: [], books: [], assets: [] })
  );
  const file = path.join(vaultRoot, "notebook.md");
  await writeFile(
    file,
    "---\ntitle: Notebook\ntags: [research]\n---\n# Notebook\n\nA saffron owl."
  );
  const annotation = {
    id: "annotation",
    docSlug: "browser/allowed",
    quote: "emerald fox",
    turns: [{ author: "human", body: "Saved reflection" }],
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  };
  await writeFile(
    path.join(managedRoot, "annotations.json"),
    JSON.stringify({ annotations: [annotation] })
  );
  await writeFile(
    path.join(vaultRoot, ".verto", "annotations.json"),
    JSON.stringify({
      annotations: [
        {
          ...annotation,
          id: "vault-note",
          docSlug: `runtime-local/${file}`,
          quote: "saffron owl",
          turns: [{ author: "human", body: "Vault reflection" }],
        },
      ],
    })
  );
  const token = "va1_fixture-only-credential";
  const grant: AgentGrant = {
    id: "fixture-client",
    name: "Fixture",
    tokenHash: createHash("sha256").update(token).digest("hex"),
    managedRoot,
    vaultRoot,
    scopes: ["documents:read", "annotations:read"],
    includeDrafts: false,
    createdAt: "2026-10-01T00:00:00Z",
  };
  const accessFile = path.join(directory, "agent-access-v1.json");
  const writeGrant = async (next: AgentGrant | null) =>
    writeFile(accessFile, JSON.stringify({ version: 1, grants: next ? [next] : [] }));
  await writeGrant(grant);
  return {
    directory,
    managedRoot,
    vaultRoot,
    libraryPath,
    articles,
    accessFile,
    token,
    grant,
    writeGrant,
    options: { accessFile, clientId: grant.id, token },
    async cleanup() {
      if (!path.basename(directory).startsWith("verto-agent-fixture-"))
        throw new Error("Unexpected fixture path");
      await rm(directory, { recursive: true, force: true });
    },
  };
}
