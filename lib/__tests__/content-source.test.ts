import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

// The Library tree API (getContentTree, listAllFiles, slug resolvers, …) is
// source-agnostic but defaults to the local filesystem source. Rather than
// depend on whatever happens to live in the repo's ./content folder, we point
// VERTO_LOCAL_DIR at a self-contained temporary corpus and assert the tree
// builder discovers, orders, resolves and overrides it correctly.
//
// The source factory is memoised on first use (see lib/content-source/tree.ts),
// so the env vars must be set before the first API call — beforeAll runs ahead
// of every `it`, and the corpus stays fixed for the whole file.

let fixtureDir: string;
let prevLocalDir: string | undefined;
let prevContentSource: string | undefined;

beforeAll(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "verto-content-source-"));
  await fs.mkdir(path.join(fixtureDir, "blog"), { recursive: true });
  await fs.mkdir(path.join(fixtureDir, "showcase"), { recursive: true });

  await fs.writeFile(
    path.join(fixtureDir, "blog", "building-verto.md"),
    "# Building Verto\n\nA first post about building Verto.\n",
    "utf-8"
  );
  await fs.writeFile(
    path.join(fixtureDir, "showcase", "the-verto-kitchen-sink.md"),
    "# The Verto Kitchen Sink\n\nEverything, everywhere, all at once.\n",
    "utf-8"
  );
  await fs.writeFile(
    path.join(fixtureDir, "navigation.json"),
    JSON.stringify({
      overrides: {
        blog: { title: "Blog Archive", order: 1 },
        showcase: { title: "Showcase", order: 2 },
      },
    }),
    "utf-8"
  );

  prevLocalDir = process.env.VERTO_LOCAL_DIR;
  prevContentSource = process.env.VERTO_CONTENT_SOURCE;
  process.env.VERTO_LOCAL_DIR = fixtureDir;
  process.env.VERTO_CONTENT_SOURCE = "local";
});

afterAll(async () => {
  if (prevLocalDir === undefined) delete process.env.VERTO_LOCAL_DIR;
  else process.env.VERTO_LOCAL_DIR = prevLocalDir;
  if (prevContentSource === undefined) delete process.env.VERTO_CONTENT_SOURCE;
  else process.env.VERTO_CONTENT_SOURCE = prevContentSource;
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

describe("content-source", () => {
  it("exports the public API", async () => {
    const mod = await import("@/lib/content-source");
    expect(typeof mod.getContentTree).toBe("function");
    expect(typeof mod.listAllFiles).toBe("function");
    expect(typeof mod.getNodeBySlug).toBe("function");
    expect(typeof mod.getFileBySlug).toBe("function");
    expect(typeof mod.getPrevNext).toBe("function");
    expect(typeof mod.getAllReadableSlugs).toBe("function");
    expect(typeof mod.walkTree).toBe("function");
  });

  it("builds a tree rooted at the configured local directory", async () => {
    const { getContentTree } = await import("@/lib/content-source");
    const root = await getContentTree();
    expect(root.type).toBe("dir");
    expect(root.slug).toEqual([]);
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it("discovers files under the configured local directory", async () => {
    const { listAllFiles } = await import("@/lib/content-source");
    const files = await listAllFiles();
    const slugs = files.map((f) => f.slug.join("/"));

    expect(slugs).toContain("blog/building-verto");
    expect(slugs).toContain("showcase/the-verto-kitchen-sink");
  });

  it("resolves a slug to its file node", async () => {
    const { getFileBySlug } = await import("@/lib/content-source");
    const file = await getFileBySlug(["blog", "building-verto"]);
    expect(file).not.toBeNull();
    expect(file!.type).toBe("file");
    expect(file!.title.length).toBeGreaterThan(0);
    expect(file!.href).toBe("/read/blog/building-verto");
  });

  it("returns null for an unknown slug", async () => {
    const { getFileBySlug } = await import("@/lib/content-source");
    const result = await getFileBySlug(["no", "such", "doc"]);
    expect(result).toBeNull();
  });

  it("produces prev/next navigation siblings", async () => {
    const { listAllFiles, getPrevNext } = await import("@/lib/content-source");
    const files = await listAllFiles();
    expect(files.length).toBeGreaterThan(1);

    // First file → prev null, next defined
    const [prev0, next0] = await getPrevNext(files[0].slug);
    expect(prev0).toBeNull();
    expect(next0).not.toBeNull();
    expect(next0!.slug).toEqual(files[1].slug);

    // Last file → next null
    const last = files[files.length - 1];
    const [, nextLast] = await getPrevNext(last.slug);
    expect(nextLast).toBeNull();
  });

  it("honors title overrides from navigation.json", async () => {
    const { getNodeBySlug } = await import("@/lib/content-source");
    // navigation.json overrides "blog" → "Blog Archive" (distinct from the
    // humanized "Blog"), proving the override path is exercised.
    const node = await getNodeBySlug(["blog"]);
    expect(node).not.toBeNull();
    expect(node!.title).toBe("Blog Archive");
  });

  it("enumerates static slugs without duplicates", async () => {
    const { getAllReadableSlugs } = await import("@/lib/content-source");
    const slugs = await getAllReadableSlugs();
    const keys = slugs.map((s) => s.join("/"));
    const dedup = new Set(keys);
    expect(dedup.size).toBe(keys.length);
    // Every slug should be non-empty
    for (const s of slugs) expect(s.length).toBeGreaterThan(0);
  });
});

describe("content-source title fallbacks", () => {
  it("derives a non-empty title for every file from its first H1", async () => {
    const { listAllFiles } = await import("@/lib/content-source");
    const files = await listAllFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.title).toBeTruthy();
      expect(typeof f.title).toBe("string");
    }
  });
});
