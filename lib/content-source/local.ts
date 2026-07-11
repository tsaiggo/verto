// Local filesystem source.
//
// Reads `.md` / `.mdx` files from a root directory on disk. The folder is
// configurable via the `VERTO_LOCAL_DIR` environment variable so Verto can
// point at any local content folder; when it is unset the source falls back
// to `content/` under `process.cwd()` (the original Verto behavior, kept
// bug-for-bug compatible so the public API of `lib/content-source` is
// unchanged when `VERTO_CONTENT_SOURCE` is unset).

import fs from "fs/promises";
import path from "path";

import type { ContentSource, RawFileEntry } from "./types";
import { isReadable } from "./tree";

export interface LocalSourceOptions {
  /**
   * Path to the content root. May be absolute or relative to the current
   * working directory. Defaults to `VERTO_LOCAL_DIR` when set, otherwise
   * `<cwd>/content`.
   */
  rootDir?: string;
}

/**
 * Resolve the absolute content root for the local source. Honours an explicit
 * override, then `VERTO_LOCAL_DIR`, then the default `content/` folder.
 * Relative paths are resolved against the current working directory.
 */
export function resolveLocalDir(
  override?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const configured = (override ?? env.VERTO_LOCAL_DIR ?? "").trim();
  // This value comes from an operator-selected directory at runtime. Telling
  // Turbopack not to trace it prevents a dynamic path from pulling the entire
  // workspace into the server bundle.
  if (configured) return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  return path.join(process.cwd(), "content");
}

export function createLocalSource(opts: LocalSourceOptions = {}): ContentSource {
  const rootDir = resolveLocalDir(opts.rootDir);

  async function walk(absDir: string, relSegs: string[], out: RawFileEntry[]): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      // Skip dotfiles (.git, .DS_Store, etc.) just like the original walker.
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, [...relSegs, entry.name], out);
      } else if (entry.isFile() && isReadable(entry.name)) {
        const stat = await fs.stat(abs);
        out.push({
          path: [...relSegs, entry.name],
          id: abs,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      }
    }
  }

  return {
    id: "local",
    label: `local (${rootDir})`,
    async listFiles(): Promise<RawFileEntry[]> {
      const out: RawFileEntry[] = [];
      await walk(rootDir, [], out);
      return out;
    },
    async readFile(entry): Promise<string> {
      // Prefer the opaque id (absolute path); fall back to the optional
      // path segments only if the caller supplied them.
      const abs =
        entry.id && path.isAbsolute(entry.id)
          ? entry.id
          : entry.path
            ? path.join(rootDir, ...entry.path)
            : entry.id;
      return fs.readFile(abs, "utf-8");
    },
    async readOptionalFile(segs: string[]): Promise<string | null> {
      try {
        return await fs.readFile(path.join(rootDir, ...segs), "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
  };
}
