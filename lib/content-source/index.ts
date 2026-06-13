// Content source registry.
//
// Picks the active `ContentSource` from environment variables and exports
// the high-level read API that the rest of the app consumes. The legacy
// `lib/content-source.ts` re-exports everything here so existing imports
// keep working.
//
//   VERTO_CONTENT_SOURCE=local     # default — read from a local folder
//                                  #   (VERTO_LOCAL_DIR, defaults to ./content)
//   VERTO_CONTENT_SOURCE=github    # see ./github.ts
//   VERTO_CONTENT_SOURCE=onedrive  # see ./onedrive.ts
//   VERTO_CONTENT_SOURCE=docs      # built-in bundled docs only (see ./builtin.ts)
//
// Regardless of the active source, the built-in docs are overlaid under the
// reserved `/read/_docs/…` slug prefix so help is always one click away. Set
// `VERTO_BUILTIN_DOCS=off` to disable the overlay.

import type { ContentSource } from "./types";
import { createLocalSource } from "./local";
import { createGitHubSource } from "./github";
import { createOneDriveSource } from "./onedrive";
import { createBuiltinSource } from "./builtin";
import { createCompositeSource } from "./composite";
import { createTreeAPI, walkTree } from "./tree";

export type {
  ContentNode,
  ContentDirNode,
  ContentFileNode,
  ContentSource,
  NavigationOverrides,
  RawFileEntry,
} from "./types";

function pickSource(): ContentSource {
  const kind = (process.env.VERTO_CONTENT_SOURCE ?? "local")
    .trim()
    .toLowerCase();

  let active: ContentSource;
  let activeIsBuiltin = false;
  switch (kind) {
    case "":
    case "local":
      active = createLocalSource();
      break;
    case "github":
      active = createGitHubSource();
      break;
    case "onedrive":
      active = createOneDriveSource();
      break;
    case "docs":
    case "builtin":
      active = createBuiltinSource();
      activeIsBuiltin = true;
      break;
    default:
      throw new Error(
        `Unknown VERTO_CONTENT_SOURCE="${kind}". ` +
          `Expected one of: local, github, onedrive, docs.`,
      );
  }

  // Always-on overlay: surface the built-in docs alongside the active source
  // (unless the docs already *are* the active source, or the overlay is
  // explicitly disabled).
  const overlay = (process.env.VERTO_BUILTIN_DOCS ?? "overlay")
    .trim()
    .toLowerCase();
  if (!activeIsBuiltin && overlay !== "off") {
    return createCompositeSource(active, createBuiltinSource());
  }
  return active;
}

// Lazy: the source is constructed on first use so test setups can mutate
// env vars before importing the module without paying for an eager init.
const api = createTreeAPI(pickSource);

export const {
  getActiveSource,
  getContentTree,
  listAllFiles,
  getNodeBySlug,
  getFileBySlug,
  getPrevNext,
  getAllReadableSlugs,
  readFileNodeSource,
} = api;

export { walkTree };
