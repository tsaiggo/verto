import { describe, it, expect } from "vitest";

import {
  createBuiltinSource,
  BUILTIN_ID_PREFIX,
  type BuiltinManifestEntry,
} from "@/lib/content-source/builtin";
import { createCompositeSource } from "@/lib/content-source/composite";
import type { ContentSource, RawFileEntry } from "@/lib/content-source/types";

// ---------------------------------------------------------------------------
// A small in-memory manifest standing in for builtin-manifest.generated.ts.
// ---------------------------------------------------------------------------

const MANIFEST: BuiltinManifestEntry[] = [
  { path: ["index.mdx"], text: "---\ntitle: Verto Docs\n---\n# Verto Docs" },
  {
    path: ["getting-started.mdx"],
    text: "---\ntitle: Getting Started\norder: 1\n---\n# Getting Started",
  },
  { path: ["assets", "logo.png"], text: "not-readable" },
  {
    path: ["navigation.json"],
    text: JSON.stringify({
      overrides: {
        ".": { title: "Verto Docs", order: 99 },
        "getting-started": { order: 1 },
      },
    }),
  },
];

describe("builtin content source", () => {
  it("enumerates readable docs under the reserved _docs prefix", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST });
    const files = await source.listFiles();
    const paths = files.map((f) => f.path.join("/")).sort();

    // navigation.json and the non-readable asset are excluded.
    expect(paths).toEqual(["_docs/getting-started.mdx", "_docs/index.mdx"]);
    // ids are namespaced and independent of the mount prefix.
    for (const f of files) expect(f.id.startsWith(BUILTIN_ID_PREFIX)).toBe(true);
  });

  it("reads raw text back by opaque id", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST });
    const files = await source.listFiles();
    const intro = files.find((f) => f.path.join("/") === "_docs/index.mdx")!;
    const text = await source.readFile({ id: intro.id });
    expect(text).toContain("title: Verto Docs");
  });

  it("throws for an unknown id", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST });
    await expect(source.readFile({ id: "verto-builtin::nope.mdx" })).rejects.toThrow(
      /unknown id/,
    );
  });

  it("remaps navigation.json keys under the prefix (and '.' to the mount dir)", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST });
    const raw = await source.readOptionalFile!(["navigation.json"]);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.overrides["_docs"]).toEqual({ title: "Verto Docs", order: 99 });
    expect(parsed.overrides["_docs/getting-started"]).toEqual({ order: 1 });
    expect(parsed.overrides["."]).toBeUndefined();
  });

  it("returns null for unknown optional files", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST });
    expect(await source.readOptionalFile!(["missing.json"])).toBeNull();
  });

  it("can mount at the root with an empty prefix (dropping the '.' override)", async () => {
    const source = createBuiltinSource({ manifest: MANIFEST, prefix: "" });
    const files = await source.listFiles();
    expect(files.map((f) => f.path.join("/")).sort()).toEqual([
      "getting-started.mdx",
      "index.mdx",
    ]);
    const parsed = JSON.parse((await source.readOptionalFile!(["navigation.json"]))!);
    expect(parsed.overrides["getting-started"]).toEqual({ order: 1 });
    expect(parsed.overrides["."]).toBeUndefined();
    expect(parsed.overrides[""]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Composite overlay
// ---------------------------------------------------------------------------

function fakePrimary(files: RawFileEntry[], nav?: string): ContentSource {
  const byId = new Map(files.map((f) => [f.id, `body:${f.id}`]));
  return {
    id: "fake",
    label: "fake primary",
    async listFiles() {
      return files.map((f) => ({ ...f, path: [...f.path] }));
    },
    async readFile(entry) {
      const text = byId.get(entry.id);
      if (text === undefined) throw new Error(`fake: unknown id ${entry.id}`);
      return text;
    },
    async readOptionalFile(segs) {
      if (segs.length === 1 && segs[0] === "navigation.json") return nav ?? null;
      return null;
    },
  };
}

describe("composite content source (built-in docs overlay)", () => {
  it("merges file lists from both sources", async () => {
    const primary = fakePrimary([
      { path: ["docs", "intro.md"], id: "p1" },
      { path: ["blog", "post.mdx"], id: "p2" },
    ]);
    const builtin = createBuiltinSource({ manifest: MANIFEST });
    const composite = createCompositeSource(primary, builtin);

    const paths = (await composite.listFiles()).map((f) => f.path.join("/")).sort();
    expect(paths).toEqual([
      "_docs/getting-started.mdx",
      "_docs/index.mdx",
      "blog/post.mdx",
      "docs/intro.md",
    ]);
  });

  it("dispatches reads to the owning source by id namespace", async () => {
    const primary = fakePrimary([{ path: ["docs", "intro.md"], id: "p1" }]);
    const builtin = createBuiltinSource({ manifest: MANIFEST });
    const composite = createCompositeSource(primary, builtin);

    const files = await composite.listFiles();
    const docFile = files.find((f) => f.path.join("/") === "_docs/index.mdx")!;
    const userFile = files.find((f) => f.path.join("/") === "docs/intro.md")!;

    expect(await composite.readFile({ id: docFile.id })).toContain("Verto Docs");
    expect(await composite.readFile({ id: userFile.id })).toBe("body:p1");
  });

  it("merges navigation overrides from both sources", async () => {
    const primary = fakePrimary(
      [{ path: ["docs", "intro.md"], id: "p1" }],
      JSON.stringify({ overrides: { docs: { title: "Docs", order: 1 } } }),
    );
    const builtin = createBuiltinSource({ manifest: MANIFEST });
    const composite = createCompositeSource(primary, builtin);

    const parsed = JSON.parse(
      (await composite.readOptionalFile!(["navigation.json"]))!,
    );
    expect(parsed.overrides["docs"]).toEqual({ title: "Docs", order: 1 });
    expect(parsed.overrides["_docs"]).toEqual({ title: "Verto Docs", order: 99 });
  });

  it("reserves the built-in prefix so user content can't shadow the docs", async () => {
    const primary = fakePrimary([
      { path: ["_docs", "evil.md"], id: "p1" },
      { path: ["notes", "ok.md"], id: "p2" },
    ]);
    const builtin = createBuiltinSource({ manifest: MANIFEST });
    const composite = createCompositeSource(primary, builtin);

    const paths = (await composite.listFiles()).map((f) => f.path.join("/")).sort();
    expect(paths).not.toContain("_docs/evil.md");
    expect(paths).toContain("notes/ok.md");
    expect(paths).toContain("_docs/index.mdx");
  });
});
