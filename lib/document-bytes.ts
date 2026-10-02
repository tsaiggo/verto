/** Compact native IPC encoding without one JavaScript number per source byte. */
export function encodeDocumentBytes(bytes: ArrayBuffer): string {
  const input = new Uint8Array(bytes);
  const chunks: string[] = [];
  for (let offset = 0; offset < input.length; offset += 32768)
    chunks.push(String.fromCharCode(...input.subarray(offset, offset + 32768)));
  return btoa(chunks.join(""));
}

export function decodeDocumentBytes(encoded: string): ArrayBuffer {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}
