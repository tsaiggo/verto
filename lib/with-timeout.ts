/**
 * Reject a promise if it does not settle within `ms` milliseconds.
 *
 * The diagram renderers (`Excalidraw.exportToSvg`, `mermaid.render`) await
 * browser primitives — `fetch` for font/asset subsetting, `document.fonts.load`
 * — that have no built-in timeout. When the network blackholes a request
 * (offline, firewall, captive portal) the awaited promise never settles and the
 * component is stuck on "Loading…" forever. Wrapping the call in `withTimeout`
 * converts that silent hang into a surfaced error the UI can render.
 *
 * Implemented with an explicit timer (rather than `Promise.race` against a bare
 * `setTimeout`) so the timer is always cleared once the wrapped promise wins —
 * no dangling handle to keep the event loop, or a fake-timer test clock, alive.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      }
    );
  });
}
