// Content source registry.
//
// Picks the active `ContentSource` from environment variables and exports
// the high-level read API that the rest of the app consumes. The legacy
// `lib/content-source.ts` re-exports everything here so existing imports
// keep working.
//
//   VERTO_CONTENT_SOURCE=local     # default — read from ./content
//   VERTO_CONTENT_SOURCE=github    # see ./github.ts
//   VERTO_CONTENT_SOURCE=onedrive  # see ./onedrive.ts

import type { ContentSource } from "./types";
import { createLocalSource } from "./local";
import { createGitHubSource } from "./github";
import { createOneDriveSource } from "./onedrive";
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
  switch (kind) {
    case "":
    case "local":
      return createLocalSource();
    case "github":
      return createGitHubSource();
    case "onedrive":
      return createOneDriveSource();
    default:
      throw new Error(
        `Unknown VERTO_CONTENT_SOURCE="${kind}". ` +
          `Expected one of: local, github, onedrive.`,
      );
  }
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
