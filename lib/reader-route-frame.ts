/** Reader routes that keep the document-tab band while content streams or fails. */
export function readerRouteHasDocumentTabs(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (!normalized.startsWith("/read/")) return false;
  return !/^\/read\/(?:tags|status)(?:\/|$)/.test(normalized);
}
