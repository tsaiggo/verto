// Composite content source — overlays the built-in docs on top of a primary
// source.
//
// Verto's built-in docs should not be an *either/or* with the user's content:
// whether you are reading a local folder, a GitHub repo, or OneDrive, the
// bundled help docs stay one click away. This wrapper merges a `primary`
// source with a `secondary` (the built-in docs, already mounted under their
// reserved `_docs` prefix) into a single `ContentSource`, so the rest of the
// app — tree builder, reader route, sidebar — stays completely unchanged.
//
// Reads are dispatched by id: the built-in source namespaces its ids (see
// `BUILTIN_ID_PREFIX`), everything else is owned by the primary source.
// `navigation.json` overrides from both sources are merged.

import type { ContentSource, RawFileEntry } from "./types";
import { BUILTIN_ID_PREFIX } from "./builtin";

const NAVIGATION_FILE = "navigation.json";

interface OverridesShape {
  overrides?: Record<string, unknown>;
}

function parseOverrides(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as OverridesShape;
    if (parsed && typeof parsed === "object" && parsed.overrides) {
      return parsed.overrides;
    }
  } catch {
    // Ignore malformed navigation files — treat as "no overrides".
  }
  return {};
}

/**
 * Combine a primary source with the built-in docs source. The built-in source
 * is expected to mount its files under a reserved slug prefix so the two file
 * sets never collide.
 */
export function createCompositeSource(
  primary: ContentSource,
  secondary: ContentSource,
): ContentSource {
  return {
    id: `${primary.id}+${secondary.id}`,
    label: primary.label
      ? `${primary.label} + ${secondary.label ?? secondary.id}`
      : undefined,

    async listFiles(): Promise<RawFileEntry[]> {
      const [primaryFiles, secondaryFiles] = await Promise.all([
        primary.listFiles(),
        secondary.listFiles(),
      ]);
      // Reserve the built-in prefix: drop any primary entries that would
      // collide with the built-in mount so the docs always win their slot.
      const reserved = new Set(
        secondaryFiles
          .map((f) => f.path[0])
          .filter((seg): seg is string => Boolean(seg)),
      );
      const safePrimary = primaryFiles.filter(
        (f) => !reserved.has(f.path[0]),
      );
      return [...safePrimary, ...secondaryFiles];
    },

    async readFile(entry): Promise<string> {
      if (entry.id.startsWith(BUILTIN_ID_PREFIX)) {
        return secondary.readFile(entry);
      }
      return primary.readFile(entry);
    },

    async readOptionalFile(segs: string[]): Promise<string | null> {
      if (!(segs.length === 1 && segs[0] === NAVIGATION_FILE)) {
        // Any other optional file belongs to the primary source.
        return primary.readOptionalFile
          ? primary.readOptionalFile(segs)
          : null;
      }
      const [primaryRaw, secondaryRaw] = await Promise.all([
        primary.readOptionalFile
          ? primary.readOptionalFile(segs)
          : Promise.resolve(null),
        secondary.readOptionalFile
          ? secondary.readOptionalFile(segs)
          : Promise.resolve(null),
      ]);
      const merged = {
        ...parseOverrides(primaryRaw),
        ...parseOverrides(secondaryRaw),
      };
      return JSON.stringify({ overrides: merged });
    },
  };
}
