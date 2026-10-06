import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { ContentAccessError } from "./types";

export interface AgentGrant {
  id: string;
  name: string;
  tokenHash: string;
  managedRoot: string;
  vaultRoot?: string;
  annotationRoot?: string;
  documentIds?: string[];
  includeDrafts: boolean;
  scopes: ("documents:read" | "annotations:read")[];
  createdAt: string;
}

export interface NodeRepositoryOptions {
  accessFile: string;
  clientId: string;
  token: string;
}

export async function readPlainFile(
  file: string,
  maxBytes: number,
  expected?: { ino: number; dev: number }
): Promise<string | null> {
  let before;
  try {
    before = await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink() || before.size > maxBytes)
    throw new Error("Content storage must be a bounded regular file.");
  if (expected && (before.ino !== expected.ino || before.dev !== expected.dev))
    throw new Error("Content path changed while opening.");
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const current = await handle.stat();
    if (
      !current.isFile() ||
      current.size > maxBytes ||
      current.ino !== before.ino ||
      current.dev !== before.dev
    )
      throw new Error("Content storage changed while opening.");
    const data = await handle.readFile();
    if (data.length > maxBytes) throw new Error("Content storage is too large.");
    return data.toString("utf8");
  } finally {
    await handle.close();
  }
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  if (process.platform !== "win32") return resolved;
  return resolved
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/, "")
    .toLocaleLowerCase();
}

export async function plainRoot(root: string): Promise<string> {
  const metadata = await lstat(root);
  const canonical = await realpath(root);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    comparablePath(canonical) !== comparablePath(root)
  )
    throw new ContentAccessError("access_denied", "The authorized library is unavailable.");
  return canonical;
}

async function containedFile(root: string, relative: string) {
  const file = path.join(root, relative);
  const before = await lstat(file);
  const canonical = await realpath(file);
  const displacement = path.relative(comparablePath(root), comparablePath(canonical));
  if (
    !displacement ||
    displacement.startsWith(`..${path.sep}`) ||
    displacement === ".." ||
    path.isAbsolute(displacement) ||
    comparablePath(canonical) !== comparablePath(file)
  )
    throw new Error("Content path is outside the authorized library.");
  const parents = path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean);
  let directory = root;
  await plainRoot(directory);
  for (const segment of parents) {
    directory = path.join(directory, segment);
    await plainRoot(directory);
  }
  if (!before.isFile() || before.isSymbolicLink())
    throw new Error("Content storage must be a regular file.");
  return { file, before };
}

/** Preserve the leaf identity across checks/open; final-leaf nofollow alone is insufficient. */
export async function readPlainFileWithin(
  root: string,
  relative: string,
  maxBytes: number
): Promise<string | null> {
  let checked;
  try {
    checked = await containedFile(root, relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const raw = await readPlainFile(checked.file, maxBytes, checked.before);
  const after = await containedFile(root, relative);
  if (after.before.ino !== checked.before.ino || after.before.dev !== checked.before.dev)
    throw new Error("Content path changed while reading.");
  return raw;
}

function isGrant(value: unknown): value is AgentGrant {
  if (!value || typeof value !== "object") return false;
  const grant = value as Partial<AgentGrant>;
  return (
    typeof grant.id === "string" &&
    typeof grant.name === "string" &&
    typeof grant.managedRoot === "string" &&
    path.isAbsolute(grant.managedRoot) &&
    typeof grant.tokenHash === "string" &&
    /^[a-f0-9]{64}$/.test(grant.tokenHash) &&
    typeof grant.includeDrafts === "boolean" &&
    Array.isArray(grant.scopes) &&
    grant.scopes.includes("documents:read") &&
    grant.scopes.every((scope) => scope === "documents:read" || scope === "annotations:read") &&
    validOptionalFields(grant) &&
    typeof grant.createdAt === "string"
  );
}

function validOptionalFields(grant: Partial<AgentGrant>): boolean {
  const rootValid =
    grant.vaultRoot === undefined ||
    (typeof grant.vaultRoot === "string" && path.isAbsolute(grant.vaultRoot));
  const idsValid =
    grant.documentIds === undefined ||
    (Array.isArray(grant.documentIds) &&
      grant.documentIds.every((id) => typeof id === "string" && id.length > 0 && id.length < 4096));
  const annotationRootValid =
    grant.annotationRoot === undefined ||
    (typeof grant.annotationRoot === "string" && path.isAbsolute(grant.annotationRoot));
  return rootValid && idsValid && annotationRootValid;
}

/** Nothing is cached: deleting a grant revokes even an already connected client. */
export async function readAgentGrant(
  options: NodeRepositoryOptions,
  scope: "documents:read" | "annotations:read" = "documents:read"
): Promise<AgentGrant> {
  try {
    const raw = await readPlainFile(options.accessFile, 1024 * 1024);
    const manifest: unknown = JSON.parse(raw ?? "null");
    if (
      !manifest ||
      typeof manifest !== "object" ||
      !("version" in manifest) ||
      manifest.version !== 1 ||
      !("grants" in manifest) ||
      !Array.isArray(manifest.grants)
    )
      throw new Error("Invalid access manifest");
    const grant = manifest.grants.find(
      (item: unknown) => isGrant(item) && item.id === options.clientId
    );
    if (!isGrant(grant) || !grant.scopes.includes(scope)) throw new Error("Missing grant");
    const hash = createHash("sha256").update(options.token).digest();
    if (!options.token || !timingSafeEqual(hash, Buffer.from(grant.tokenHash, "hex")))
      throw new Error("Invalid credential");
    return grant;
  } catch {
    throw new ContentAccessError("access_denied", "Agent access is unavailable or revoked.");
  }
}

export function grantAllows(grant: AgentGrant, id: string, draft: boolean): boolean {
  return (
    (!draft || grant.includeDrafts) &&
    (grant.documentIds === undefined || grant.documentIds.includes(id))
  );
}

export async function ensureGrantUnchanged(
  options: NodeRepositoryOptions,
  before: AgentGrant,
  scope: "documents:read" | "annotations:read" = "documents:read"
) {
  const after = await readAgentGrant(options, scope);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new ContentAccessError(
      "access_denied",
      "Agent access changed during this request. Retry using the current grant."
    );
}
