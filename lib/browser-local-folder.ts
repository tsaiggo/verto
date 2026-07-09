import type { RawFileEntry } from "./content-source";
import type { FolderInspection } from "./local-folder";

export const BROWSER_LOCAL_INDEX_KEY = "verto:browser-local-index";

const DB_NAME = "verto-browser-local-files";
const DB_VERSION = 1;
const STORE_NAME = "files";
const ID_PREFIX = "browser-local:";
const FALLBACK_FOLDER_NAME = "Browser folder";

interface BrowserLocalIndex {
  folder: string;
  entries: RawFileEntry[];
  savedAt: number;
}

interface StoredBrowserLocalFile {
  id: string;
  folder: string;
  path: string[];
  text: string;
  size: number;
  mtime: number;
}

interface SelectedBrowserFile {
  path: string[];
  file: File;
}

interface BrowserFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface BrowserDirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<BrowserEntryHandle>;
}

type BrowserEntryHandle = BrowserFileHandle | BrowserDirectoryHandle;
type DirectoryPicker = () => Promise<BrowserDirectoryHandle>;
type FileWithRelativePath = File & { webkitRelativePath?: string };

export interface BrowserLocalFolderSelection {
  folder: string;
  entries: RawFileEntry[];
  inspection: FolderInspection;
}

export function canUseBrowserLocalPicker(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isBrowserLocalFileId(id: string): boolean {
  return id.startsWith(ID_PREFIX);
}

export function loadBrowserLocalIndex(): BrowserLocalIndex | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_LOCAL_INDEX_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isBrowserLocalIndex(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasBrowserLocalFolder(folder?: string | null): boolean {
  const index = loadBrowserLocalIndex();
  if (!index) return false;
  return !folder || index.folder === folder;
}

export async function pickBrowserLocalFolder(): Promise<BrowserLocalFolderSelection | null> {
  const picker = getDirectoryPicker();
  try {
    if (picker) {
      const directory = await picker();
      const selected: SelectedBrowserFile[] = [];
      await collectDirectoryFiles(directory, [], selected);
      return saveSelection(directory.name || FALLBACK_FOLDER_NAME, selected);
    }

    const files = await pickFilesWithInput();
    if (!files) return null;
    return saveSelection(folderNameFromFiles(files), files.map(fileToSelectedFile));
  } catch (error) {
    if (isAbortError(error)) return null;
    throw error;
  }
}

export async function listBrowserLocalFolder(folder: string): Promise<RawFileEntry[]> {
  const index = loadBrowserLocalIndex();
  if (!index || index.folder !== folder) return [];
  return index.entries;
}

export async function readBrowserLocalFile(id: string): Promise<string> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const file = await requestResult<StoredBrowserLocalFile | undefined>(store.get(id));
    if (!file) {
      throw new Error(
        "This browser-local file is no longer cached. Choose the folder again to reload it."
      );
    }
    return file.text;
  } finally {
    db.close();
  }
}

async function saveSelection(
  folder: string,
  files: SelectedBrowserFile[]
): Promise<BrowserLocalFolderSelection> {
  const readable = files.filter((item) => isReadablePath(item.path));
  const stored = await Promise.all(readable.map((item) => toStoredFile(folder, item)));
  const entries: RawFileEntry[] = stored.map((file) => ({
    id: file.id,
    path: file.path,
    size: file.size,
    mtime: file.mtime,
  }));
  await replaceStoredFiles(stored);
  saveBrowserLocalIndex({ folder, entries, savedAt: Date.now() });
  return {
    folder,
    entries,
    inspection: {
      exists: true,
      isDir: true,
      fileCount: entries.length,
      samples: entries.slice(0, 5).map((entry) => entry.path.join("/")),
    },
  };
}

async function collectDirectoryFiles(
  directory: BrowserDirectoryHandle,
  parent: string[],
  files: SelectedBrowserFile[]
): Promise<void> {
  for await (const entry of directory.values()) {
    if (entry.name.startsWith(".")) continue;
    const path = [...parent, entry.name];
    if (entry.kind === "directory") {
      await collectDirectoryFiles(entry, path, files);
      continue;
    }
    files.push({ path, file: await entry.getFile() });
  }
}

function fileToSelectedFile(file: File): SelectedBrowserFile {
  const rel = (file as FileWithRelativePath).webkitRelativePath?.trim();
  const segments = rel ? rel.split("/").filter(Boolean).slice(1) : [file.name];
  return { path: segments.length > 0 ? segments : [file.name], file };
}

function folderNameFromFiles(files: File[]): string {
  const first = files[0] as FileWithRelativePath | undefined;
  const rel = first?.webkitRelativePath?.trim();
  const root = rel?.split("/").filter(Boolean)[0];
  return root || FALLBACK_FOLDER_NAME;
}

function getDirectoryPicker(): DirectoryPicker | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
  return typeof candidate === "function" ? (candidate as DirectoryPicker) : null;
}

function pickFilesWithInput(): Promise<File[] | null> {
  if (typeof document === "undefined") {
    throw new Error("Browser folder picking is not available in this environment.");
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.style.display = "none";

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener(
      "change",
      () => {
        const files = input.files ? Array.from(input.files) : null;
        cleanup();
        resolve(files && files.length > 0 ? files : null);
      },
      { once: true }
    );

    document.body.append(input);
    input.click();
  });
}

async function toStoredFile(
  folder: string,
  selected: SelectedBrowserFile
): Promise<StoredBrowserLocalFile> {
  const id = browserLocalId(folder, selected.path);
  return {
    id,
    folder,
    path: selected.path,
    text: await selected.file.text(),
    size: selected.file.size,
    mtime: selected.file.lastModified || Date.now(),
  };
}

function browserLocalId(folder: string, path: string[]): string {
  return `${ID_PREFIX}${encodeURIComponent(folder)}/${path.map(encodeURIComponent).join("/")}`;
}

async function replaceStoredFiles(files: StoredBrowserLocalFile[]): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const file of files) store.put(file);
    await transactionComplete(tx);
  } finally {
    db.close();
  }
}

function saveBrowserLocalIndex(index: BrowserLocalIndex): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(BROWSER_LOCAL_INDEX_KEY, JSON.stringify(index));
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is required for browser-local file previews.");
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open browser file cache."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Browser file cache request failed."));
  });
}

function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Browser file cache transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Browser file cache transaction aborted."));
  });
}

function isReadablePath(path: string[]): boolean {
  const name = path[path.length - 1] ?? "";
  return !path.some((segment) => segment.startsWith(".")) && isReadableName(name);
}

function isReadableName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".mdx");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isBrowserLocalIndex(value: unknown): value is BrowserLocalIndex {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.folder === "string" &&
    typeof record.savedAt === "number" &&
    Array.isArray(record.entries) &&
    record.entries.every(isRawFileEntry)
  );
}

function isRawFileEntry(value: unknown): value is RawFileEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    Array.isArray(record.path) &&
    record.path.every((segment) => typeof segment === "string") &&
    (record.size === undefined || typeof record.size === "number") &&
    (record.mtime === undefined || typeof record.mtime === "number")
  );
}
