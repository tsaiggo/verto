import type { RuntimeLocalIndexedDocument } from "@/lib/runtime-local-index";

export interface VaultSidebarFolder {
  kind: "folder";
  id: string;
  name: string;
  folders: VaultSidebarFolder[];
  documents: RuntimeLocalIndexedDocument[];
}

export const ROOT_FILES_KEY = "__verto-root-files__";
const CHILDREN_KEY = "__verto-sidebar-children__";

/**
 * Materializes a stable, alphabetized directory tree from the live runtime
 * index. Root-level documents are grouped in an invisible root folder so they
 * can be shown before the first visible folder.
 */
export function buildVaultSidebarTree(
  documents: readonly RuntimeLocalIndexedDocument[]
): VaultSidebarFolder[] {
  const roots = new Map<string, VaultSidebarFolder>();
  const rootDocuments: RuntimeLocalIndexedDocument[] = [];

  for (const document of documents) {
    let folderMap = roots;
    let parentPath = "";
    for (const segment of document.entry.path.slice(0, -1)) {
      const id = parentPath ? `${parentPath}/${segment}` : segment;
      let folder = folderMap.get(segment);
      if (!folder) {
        folder = { kind: "folder", id, name: segment, folders: [], documents: [] };
        folderMap.set(segment, folder);
      }
      parentPath = id;
      folderMap = getChildMap(folder);
    }

    if (document.entry.path.length <= 1) {
      rootDocuments.push(document);
    } else {
      findFolder(roots, document.entry.path.slice(0, -1))?.documents.push(document);
    }
  }

  const folders = Array.from(roots.values());
  finalizeFolders(folders);

  if (rootDocuments.length === 0) return folders;
  return [
    {
      kind: "folder",
      id: ROOT_FILES_KEY,
      name: "",
      folders,
      documents: sortDocuments(rootDocuments),
    },
  ];
}

export function vaultName(folder: string): string {
  const segments = folder.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? "Local library";
}

type FolderWithChildren = VaultSidebarFolder & {
  [CHILDREN_KEY]?: Map<string, VaultSidebarFolder>;
};

function getChildMap(folder: VaultSidebarFolder): Map<string, VaultSidebarFolder> {
  const enriched = folder as FolderWithChildren;
  if (!enriched[CHILDREN_KEY]) {
    Object.defineProperty(enriched, CHILDREN_KEY, {
      configurable: true,
      enumerable: false,
      value: new Map<string, VaultSidebarFolder>(),
    });
  }
  return enriched[CHILDREN_KEY]!;
}

function findFolder(
  roots: Map<string, VaultSidebarFolder>,
  path: readonly string[]
): VaultSidebarFolder | undefined {
  let folders = roots;
  let current: VaultSidebarFolder | undefined;
  for (const segment of path) {
    current = folders.get(segment);
    if (!current) return undefined;
    folders = getChildMap(current);
  }
  return current;
}

function finalizeFolders(folders: VaultSidebarFolder[]): void {
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const folder of folders) {
    folder.folders = Array.from(getChildMap(folder).values());
    folder.documents = sortDocuments(folder.documents);
    finalizeFolders(folder.folders);
  }
}

function sortDocuments(
  documents: readonly RuntimeLocalIndexedDocument[]
): RuntimeLocalIndexedDocument[] {
  return [...documents].sort(
    (a, b) =>
      (a.node.order ?? Number.MAX_SAFE_INTEGER) - (b.node.order ?? Number.MAX_SAFE_INTEGER) ||
      a.node.title.localeCompare(b.node.title, undefined, { numeric: true })
  );
}
