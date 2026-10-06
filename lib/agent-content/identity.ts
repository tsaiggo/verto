export async function contentHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hashing exact bytes also detects changes made outside Verto's revision store. */
export async function contentVersion(source: string, revision?: string | number): Promise<string> {
  const hash = await contentHash(source);
  return revision === undefined ? `content:${hash}` : `revision:${revision}:${hash}`;
}

export async function vaultDocumentId(root: string, relativePath: string): Promise<string> {
  const identity = root
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
  const canonical = /^(?:[a-z]:\/|\/\/)/i.test(identity) ? identity.toLocaleLowerCase() : identity;
  return `vault:${(await contentHash(canonical)).slice(0, 16)}:${encodeURIComponent(relativePath.replace(/\\/g, "/"))}`;
}
