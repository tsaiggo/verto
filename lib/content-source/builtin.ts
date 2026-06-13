// Built-in docs content source.
//
// Serves the documentation that ships *inside* Verto. Unlike the local /
// github / onedrive sources, this one reads from an embedded manifest
// (`builtin-manifest.generated.ts`, produced from `builtin-docs/` at build
// time) — no filesystem, no network. That makes the docs fully portable and
// available even in the Tauri static-export build where there is no writable
// content folder at runtime.
//
// The docs are mounted under a reserved slug prefix (default `_docs`) so they
// can be overlaid on top of any user content source without colliding. See
// `./composite.ts` for the always-on overlay and `./index.ts` for wiring.

import type { ContentSource, RawFileEntry } from "./types";
import { isReadable } from "./tree";
import { BUILTIN_MANIFEST } from "./builtin-manifest.generated";

/** One embedded file: its path segments (relative to `builtin-docs/`) + text. */
export interface BuiltinManifestEntry {
  path: string[];
  text: string;
}

export interface BuiltinSourceOptions {
  /** Embedded corpus; defaults to the generated manifest. */
  manifest?: BuiltinManifestEntry[];
  /**
   * Reserved slug prefix the docs are mounted under. Defaults to `_docs`.
   * Pass `""` to mount the docs at the root (no prefix).
   */
  prefix?: string;
}

const NAVIGATION_FILE = "navigation.json";
/** Distinctive id namespace so a composite source can dispatch reads. */
export const BUILTIN_ID_PREFIX = "verto-builtin::";

interface BuiltinNavigation {
  overrides?: Record<
    string,
    { title?: string; order?: number; hidden?: boolean }
  >;
}

/**
 * Re-key the embedded `navigation.json` overrides so they line up with the
 * mounted slug paths. The special key `"."` refers to the mount directory
 * itself; every other key is joined under the prefix.
 */
function remapNavigation(raw: string, prefix: string): string | null {
  let parsed: BuiltinNavigation;
  try {
    parsed = JSON.parse(raw) as BuiltinNavigation;
  } catch {
    return null;
  }
  const src = parsed.overrides;
  if (!src || typeof src !== "object") return JSON.stringify({ overrides: {} });

  const out: NonNullable<BuiltinNavigation["overrides"]> = {};
  for (const [key, value] of Object.entries(src)) {
    let mapped: string;
    if (key === "." || key === "") {
      // The mount directory itself. With no prefix there is no node to target.
      if (!prefix) continue;
      mapped = prefix;
    } else {
      mapped = prefix ? `${prefix}/${key}` : key;
    }
    out[mapped] = value;
  }
  return JSON.stringify({ overrides: out });
}

export function createBuiltinSource(
  opts: BuiltinSourceOptions = {},
): ContentSource {
  const prefix = opts.prefix ?? "_docs";
  const manifest = opts.manifest ?? BUILTIN_MANIFEST;

  const textById = new Map<string, string>();
  const files: RawFileEntry[] = [];
  let navigationRaw: string | null = null;

  for (const entry of manifest) {
    const name = entry.path[entry.path.length - 1] ?? "";
    if (entry.path.length === 1 && name === NAVIGATION_FILE) {
      navigationRaw = entry.text;
      continue;
    }
    if (!isReadable(name)) continue;
    // Id is independent of the mount prefix so reads are stable regardless of
    // where the docs are mounted.
    const id = BUILTIN_ID_PREFIX + entry.path.join("/");
    textById.set(id, entry.text);
    files.push({
      path: prefix ? [prefix, ...entry.path] : [...entry.path],
      id,
    });
  }

  return {
    id: "builtin",
    label: "builtin (bundled docs)",

    async listFiles(): Promise<RawFileEntry[]> {
      // Return copies so callers can't mutate our cached paths.
      return files.map((f) => ({ ...f, path: [...f.path] }));
    },

    async readFile(entry): Promise<string> {
      const text = textById.get(entry.id);
      if (text === undefined) {
        throw new Error(
          `builtin source: unknown id "${entry.id}" (not in the embedded manifest).`,
        );
      }
      return text;
    },

    async readOptionalFile(segs: string[]): Promise<string | null> {
      if (segs.length === 1 && segs[0] === NAVIGATION_FILE) {
        if (!navigationRaw) return null;
        return remapNavigation(navigationRaw, prefix);
      }
      return null;
    },
  };
}
