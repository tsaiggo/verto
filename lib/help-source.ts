// Help content source.
//
// Verto ships a set of bundled product docs ("Help") that must always be
// available regardless of which `ContentSource` backs the user Library. The
// user can point `/read/*` at a local folder or a OneDrive folder via
// `VERTO_CONTENT_SOURCE` / `VERTO_LOCAL_DIR`, but the Help section stays put.
//
// We get that isolation by building a *second* tree API around a dedicated
// local source pinned to the bundled `help-content/` directory. Passing an
// explicit `rootDir` makes `resolveLocalDir` ignore `VERTO_LOCAL_DIR`, so the
// Help tree never follows the Library when its source is swapped. Every href
// is rendered under the `/help` base path (the Library uses `/read`).

import type { ContentSource } from "./content-source/types";
import { createLocalSource } from "./content-source/local";
import { createTreeAPI } from "./content-source/tree";

export type {
  ContentNode,
  ContentDirNode,
  ContentFileNode,
  NavigationOverrides,
} from "./content-source/types";

function helpSource(): ContentSource {
  return createLocalSource({ rootDir: "help-content" });
}

const api = createTreeAPI(helpSource, { basePath: "/help" });

export const {
  getActiveSource: getHelpActiveSource,
  getContentTree: getHelpContentTree,
  listAllFiles: listAllHelpFiles,
  getNodeBySlug: getHelpNodeBySlug,
  getFileBySlug: getHelpFileBySlug,
  getPrevNext: getHelpPrevNext,
  getAllReadableSlugs: getAllHelpSlugs,
  readFileNodeSource: readHelpFileNodeSource,
} = api;
