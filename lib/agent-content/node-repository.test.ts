import { describe, expect, it } from "vitest";
import { lstat, mkdir, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createNodeRepository } from "./node-repository";
import { createContentService } from "./service";
import { createContentFixture } from "./node-fixture";
import { vaultDocumentId } from "./identity";
import { readPlainFile, readPlainFileWithin } from "./node-access";
import { createBrowserRepository } from "./browser";

describe("native content repository", () => {
  it("rejects a leaf replaced after its authorized identity was checked", async () => {
    const fixture = await createContentFixture();
    try {
      const file = path.join(fixture.vaultRoot, "notebook.md");
      const before = await lstat(file);
      await rename(file, path.join(fixture.vaultRoot, "original.md"));
      await writeFile(file, "A replacement outside the captured identity.");
      await expect(readPlainFile(file, 1024, before)).rejects.toThrow(/changed/);
    } finally {
      await fixture.cleanup();
    }
  });
  it("reads selected managed notes from annotationRoot without granting that vault's documents", async () => {
    const fixture = await createContentFixture();
    try {
      await writeFile(
        path.join(fixture.vaultRoot, ".verto", "annotations.json"),
        JSON.stringify({
          annotations: [
            {
              id: "selected-note",
              docSlug: "browser/allowed",
              quote: "emerald fox",
              note: "Active workspace reflection",
            },
          ],
        })
      );
      await fixture.writeGrant({
        ...fixture.grant,
        vaultRoot: undefined,
        annotationRoot: fixture.vaultRoot,
        documentIds: ["managed:allowed"],
      });
      const service = createContentService(createNodeRepository(fixture.options));
      expect((await service.listDocuments()).documents.map((item) => item.id)).toEqual([
        "managed:allowed",
      ]);
      expect(
        (await service.listAnnotations({ docId: "managed:allowed" })).annotations.map(
          (item) => item.note
        )
      ).toEqual(["Active workspace reflection"]);
      const vaultId = await vaultDocumentId(fixture.vaultRoot, "notebook.md");
      await expect(service.readDocument({ docId: vaultId })).rejects.toMatchObject({
        code: "not_found",
      });
      expect((await service.searchDocuments({ query: "saffron" })).matches).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });
  it.skipIf(process.platform !== "win32")(
    "accepts Rust namespaced roots and shares vault identity with the renderer",
    async () => {
      const fixture = await createContentFixture();
      try {
        const vaultRoot = path.toNamespacedPath(fixture.vaultRoot);
        await fixture.writeGrant({
          ...fixture.grant,
          managedRoot: path.toNamespacedPath(fixture.managedRoot),
          vaultRoot,
          annotationRoot: vaultRoot,
        });
        const id = await vaultDocumentId(vaultRoot, "notebook.md");
        const nativeFile = path.join(vaultRoot, "notebook.md");
        await writeFile(
          path.join(fixture.vaultRoot, ".verto", "annotations.json"),
          JSON.stringify({
            annotations: [
              {
                id: "namespaced-note",
                docSlug: `runtime-local/${nativeFile}`,
                quote: "saffron owl",
                note: "Native Windows reflection",
              },
            ],
          })
        );
        const service = createContentService(createNodeRepository(fixture.options));
        const document = (await service.listDocuments()).documents.find((item) => item.id === id)!;
        expect(document).toBeDefined();
        expect((await service.listAnnotations({ docId: id })).annotations[0].note).toBe(
          "Native Windows reflection"
        );
        const browser = createBrowserRepository(
          [{ title: document.title, href: document.href, body: "# Notebook\n\nA saffron owl." }],
          { vaultRoot: fixture.vaultRoot, articles: async () => [] }
        );
        expect((await browser.listDocuments())[0].id).toBe(id);
      } finally {
        await fixture.cleanup();
      }
    }
  );
  it("reads the real managed manifest and only granted portable annotation stores", async () => {
    const fixture = await createContentFixture();
    try {
      const service = createContentService(createNodeRepository(fixture.options));
      const list = await service.listDocuments();
      expect(list.total).toBe(3);
      const id = await vaultDocumentId(fixture.vaultRoot, "notebook.md");
      expect(list.documents.find((document) => document.id === id)?.title).toBe("Notebook");
      expect(
        (await service.listAnnotations({ docId: "managed:allowed" })).annotations[0].note
      ).toBe("Saved reflection");
      expect((await service.listAnnotations({ docId: id })).annotations).toEqual([]);
      await fixture.writeGrant({ ...fixture.grant, annotationRoot: fixture.vaultRoot });
      expect((await service.listAnnotations({ docId: id })).annotations[0].note).toBe(
        "Vault reflection"
      );
      await fixture.writeGrant({ ...fixture.grant, vaultRoot: undefined });
      expect(
        (
          await service.resolveCitation({
            docId: id,
            version: "old",
            blockId: "old",
            excerpt: "owl",
          })
        ).status
      ).toBe("missing");
    } finally {
      await fixture.cleanup();
    }
  });

  it("filters before search/read, excludes drafts, and honors scope changes and revocation", async () => {
    const fixture = await createContentFixture();
    try {
      await fixture.writeGrant({
        ...fixture.grant,
        documentIds: ["managed:allowed", "managed:draft"],
        scopes: ["documents:read"],
      });
      const service = createContentService(createNodeRepository(fixture.options));
      expect(
        (await service.listDocuments({ includeDrafts: true })).documents.map((item) => item.id)
      ).toEqual(["managed:allowed"]);
      expect((await service.searchDocuments({ query: "classified" })).matches).toEqual([]);
      await expect(service.readDocument({ docId: "managed:denied" })).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(service.listAnnotations({ docId: "managed:allowed" })).rejects.toMatchObject({
        code: "access_denied",
      });
      await fixture.writeGrant({
        ...fixture.grant,
        documentIds: ["managed:allowed", "managed:draft"],
        includeDrafts: true,
      });
      expect((await service.listDocuments({ includeDrafts: true })).total).toBe(2);
      await fixture.writeGrant(null);
      await expect(service.searchDocuments({ query: "emerald" })).rejects.toMatchObject({
        code: "access_denied",
      });
      await expect(
        createContentService(
          createNodeRepository({ ...fixture.options, token: "wrong" })
        ).listDocuments()
      ).rejects.toMatchObject({ code: "access_denied" });
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects guessed paths, final symlinks and linked ancestors outside the grant", async () => {
    const fixture = await createContentFixture();
    try {
      const outside = path.join(fixture.directory, "outside");
      await mkdir(outside);
      await writeFile(path.join(outside, "secret.md"), "Outside secret.");
      await symlink(
        outside,
        path.join(fixture.vaultRoot, "linked"),
        process.platform === "win32" ? "junction" : "dir"
      );
      const service = createContentService(createNodeRepository(fixture.options));
      expect((await service.searchDocuments({ query: "Outside secret" })).matches).toEqual([]);
      await expect(
        service.readDocument({
          docId: await vaultDocumentId(fixture.vaultRoot, "../outside/secret.md"),
        })
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        readPlainFileWithin(fixture.vaultRoot, "linked/secret.md", 1024)
      ).rejects.toThrow();
      await expect(
        readPlainFileWithin(fixture.vaultRoot, "../outside/secret.md", 1024)
      ).rejects.toThrow();
    } finally {
      await fixture.cleanup();
    }
  });
});
