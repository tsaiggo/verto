let registration: Promise<boolean> | undefined;

function shellResources(): string[] {
  const urls = [
    ...Array.from(document.scripts, (script) => script.src),
    ...Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (link) => link.href
    ),
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
  ];
  return [...new Set(urls)].filter((value) => {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
    } catch {
      return false;
    }
  });
}

/** Fresh offline reloads need a secure origin (HTTPS or localhost). Mail data stays in IndexedDB. */
export function enableMailOfflineShell(): Promise<boolean> {
  if (typeof window === "undefined" || !window.isSecureContext || !("serviceWorker" in navigator))
    return Promise.resolve(false);
  if (registration) return registration;
  registration = (async () => {
    const result = await navigator.serviceWorker.register("/mail-sw.js", { scope: "/mail" });
    await navigator.serviceWorker.ready;
    const worker = result.active ?? result.waiting ?? result.installing;
    worker?.postMessage({ type: "WARM_MAIL_SHELL", resources: shellResources() });
    return Boolean(worker);
  })().catch(() => {
    registration = undefined;
    return false;
  });
  return registration;
}
