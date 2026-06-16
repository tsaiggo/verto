import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

// The Help section is a second, always-on content tree pinned to the bundled
// `help-content/` directory. It must behave like the Library tree (same tree
// builder) while differing in exactly two ways: every href is rooted at
// `/help` (not `/read`), and the source never follows `VERTO_LOCAL_DIR` when
// the user swaps their Library backend. These tests lock down both.

describe("help-source", () => {
  it("exports the public Help API", async () => {
    const mod = await import("@/lib/help-source");
    expect(typeof mod.getHelpActiveSource).toBe("function");
    expect(typeof mod.getHelpContentTree).toBe("function");
    expect(typeof mod.listAllHelpFiles).toBe("function");
    expect(typeof mod.getHelpNodeBySlug).toBe("function");
    expect(typeof mod.getHelpFileBySlug).toBe("function");
    expect(typeof mod.getHelpPrevNext).toBe("function");
    expect(typeof mod.getAllHelpSlugs).toBe("function");
    expect(typeof mod.readHelpFileNodeSource).toBe("function");
  });

  it("builds a tree rooted at help-content/", async () => {
    const { getHelpContentTree } = await import("@/lib/help-source");
    const root = await getHelpContentTree();
    expect(root.type).toBe("dir");
    expect(root.slug).toEqual([]);
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it("discovers the bundled getting-started docs", async () => {
    const { listAllHelpFiles } = await import("@/lib/help-source");
    const files = await listAllHelpFiles();
    const slugs = files.map((f) => f.slug.join("/"));

    // Confirms auto-discovery walks the help-content corpus
    expect(slugs).toContain("getting-started/introduction");
  });

  it("resolves a slug to a file node whose href is rooted at /help", async () => {
    const { getHelpFileBySlug } = await import("@/lib/help-source");
    const file = await getHelpFileBySlug(["getting-started", "introduction"]);
    expect(file).not.toBeNull();
    expect(file!.type).toBe("file");
    expect(file!.title).toBe("Introduction");
    // The defining difference from the Library tree: /help, not /read.
    expect(file!.href).toBe("/help/getting-started/introduction");
  });

  it("returns null for an unknown slug", async () => {
    const { getHelpFileBySlug } = await import("@/lib/help-source");
    const result = await getHelpFileBySlug(["no", "such", "doc"]);
    expect(result).toBeNull();
  });

  it("produces prev/next navigation siblings", async () => {
    const { listAllHelpFiles, getHelpPrevNext } = await import("@/lib/help-source");
    const files = await listAllHelpFiles();
    expect(files.length).toBeGreaterThan(1);

    // First file → prev null, next defined
    const [prev0, next0] = await getHelpPrevNext(files[0].slug);
    expect(prev0).toBeNull();
    expect(next0).not.toBeNull();
    expect(next0!.slug).toEqual(files[1].slug);

    // Last file → next null
    const last = files[files.length - 1];
    const [, nextLast] = await getHelpPrevNext(last.slug);
    expect(nextLast).toBeNull();
  });

  it("honors title overrides from help-content/navigation.json", async () => {
    const { getHelpNodeBySlug } = await import("@/lib/help-source");
    // navigation.json overrides "getting-started" → "Getting Started"
    const node = await getHelpNodeBySlug(["getting-started"]);
    expect(node).not.toBeNull();
    expect(node!.title).toBe("Getting Started");
  });

  it("enumerates static slugs without duplicates", async () => {
    const { getAllHelpSlugs } = await import("@/lib/help-source");
    const slugs = await getAllHelpSlugs();
    const keys = slugs.map((s) => s.join("/"));
    const dedup = new Set(keys);
    expect(dedup.size).toBe(keys.length);
    for (const s of slugs) expect(s.length).toBeGreaterThan(0);
  });

  it("reads the raw source text behind a file node", async () => {
    const { getHelpFileBySlug, readHelpFileNodeSource } = await import("@/lib/help-source");
    const file = await getHelpFileBySlug(["getting-started", "introduction"]);
    expect(file).not.toBeNull();
    const raw = await readHelpFileNodeSource(file!);
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).toContain("Welcome to Verto");
  });
});

describe("help-source title fallbacks", () => {
  it("gives every file a non-empty string title", async () => {
    const { listAllHelpFiles } = await import("@/lib/help-source");
    const files = await listAllHelpFiles();
    for (const f of files) {
      expect(f.title).toBeTruthy();
      expect(typeof f.title).toBe("string");
    }
  });
});

describe("help-source isolation from the Library source", () => {
  it("ignores VERTO_LOCAL_DIR and stays pinned to help-content/", async () => {
    const { getHelpActiveSource, listAllHelpFiles } = await import("@/lib/help-source");

    // Point the *Library* env knob at an unrelated folder containing a
    // sentinel file. The Help source passes an explicit rootDir, so
    // resolveLocalDir must never consult VERTO_LOCAL_DIR — the sentinel must
    // not leak in and the bundled docs must still be served.
    const decoy = await fs.mkdtemp(path.join(os.tmpdir(), "verto-help-isolation-"));
    await fs.writeFile(path.join(decoy, "should-not-appear.md"), "# Decoy", "utf-8");

    const prev = process.env.VERTO_LOCAL_DIR;
    process.env.VERTO_LOCAL_DIR = decoy;
    try {
      // The active source label encodes its resolved root directory.
      expect(getHelpActiveSource().label).toContain("help-content");
      expect(getHelpActiveSource().label).not.toContain(decoy);

      const slugs = (await listAllHelpFiles()).map((f) => f.slug.join("/"));
      expect(slugs).toContain("getting-started/introduction");
      expect(slugs).not.toContain("should-not-appear");
    } finally {
      if (prev === undefined) delete process.env.VERTO_LOCAL_DIR;
      else process.env.VERTO_LOCAL_DIR = prev;
      await fs.rm(decoy, { recursive: true, force: true });
    }
  });
});
