// Content source registry.

import type { ContentSource } from "./types";
import { createLocalSource } from "./local";
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
  const kind = (process.env.VERTO_CONTENT_SOURCE ?? "local").trim().toLowerCase();
  switch (kind) {
    case "":
    case "local":
      return createLocalSource();
    case "onedrive":
      return createOneDriveSource();
    default:
      throw new Error(
        "Unknown VERTO_CONTENT_SOURCE=" + kind + ". Expected one of: local, onedrive."
      );
  }
}

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
