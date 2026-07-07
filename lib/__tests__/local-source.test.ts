import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { createLocalSource, resolveLocalDir } from "@/lib/content-source/local";

describe("resolveLocalDir", () => {
  it("defaults to <cwd>/content when no override or env is set", () => {
    expect(resolveLocalDir(undefined, {})).toBe(path.join(process.cwd(), "content"));
  });

  it("honors VERTO_LOCAL_DIR, resolving relative paths against cwd", () => {
    expect(resolveLocalDir(undefined, { VERTO_LOCAL_DIR: "docs/vault" })).toBe(
      path.resolve(process.cwd(), "docs/vault")
    );
  });

  it("keeps absolute VERTO_LOCAL_DIR paths intact", () => {
    const abs = path.join(os.tmpdir(), "verto-vault");
    expect(resolveLocalDir(undefined, { VERTO_LOCAL_DIR: abs })).toBe(abs);
  });

  it("prefers an explicit override over the environment", () => {
    expect(resolveLocalDir("override", { VERTO_LOCAL_DIR: "ignored" })).toBe(
      path.resolve(process.cwd(), "override")
    );
  });
});

describe("createLocalSource with a custom folder", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  it("reads .md/.mdx files from the configured rootDir", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "verto-local-"));
    dirs.push(root);
    await fs.writeFile(path.join(root, "plain.md"), "# Plain", "utf-8");
    await fs.writeFile(path.join(root, "hello.mdx"), "# Hello", "utf-8");
    await fs.writeFile(path.join(root, "ignore.txt"), "nope", "utf-8");

    const source = createLocalSource({ rootDir: root });
    const files = await source.listFiles();

    expect(files.map((f) => f.path.join("/")).sort()).toEqual(["hello.mdx", "plain.md"]);
    const markdown = files.find((file) => file.path.join("/") === "plain.md");
    expect(markdown).toBeDefined();
    if (!markdown) throw new Error("plain.md should be listed");
    const body = await source.readFile(markdown);
    expect(body).toContain("# Plain");
  });

  it("skips .verto/ directories and their contents", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "verto-local-"));
    dirs.push(root);
    await fs.writeFile(path.join(root, "visible.md"), "# Visible", "utf-8");
    await fs.mkdir(path.join(root, ".verto"), { recursive: true });
    await fs.writeFile(path.join(root, ".verto", "bookmarks.json"), '{"items":[]}', "utf-8");

    const source = createLocalSource({ rootDir: root });
    const files = await source.listFiles();

    expect(files.map((f) => f.path.join("/"))).toEqual(["visible.md"]);
  });

  it("skips .git/ directories and their contents", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "verto-local-"));
    dirs.push(root);
    await fs.writeFile(path.join(root, "doc.md"), "# Doc", "utf-8");
    await fs.mkdir(path.join(root, ".git"), { recursive: true });
    await fs.writeFile(path.join(root, ".git", "HEAD"), "ref: refs/heads/main", "utf-8");

    const source = createLocalSource({ rootDir: root });
    const files = await source.listFiles();

    expect(files.map((f) => f.path.join("/"))).toEqual(["doc.md"]);
  });
});
