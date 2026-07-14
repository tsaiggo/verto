export interface StateStore {
  /** Synchronously read a named value from the store. Returns fallback on miss or parse error. */
  read<T>(name: string, fallback: T): T;
  /**
   * Wait for a named value to be restored from a portable backing store.
   *
   * Web and server stores resolve immediately. Desktop stores also start this
   * work from `read()`, so existing synchronous consumers remain compatible;
   * callers that write on mount can await it to avoid racing vault restore.
   */
  hydrate?(name: string): Promise<void>;
  /**
   * Restore the latest value, apply one read-modify-write operation, and
   * persist the result. Desktop implementations serialize this behind
   * hydration so an empty startup cache cannot overwrite portable state.
   */
  update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T>;
  /** Synchronously update the store; on desktop also queues an async write to .verto/. */
  write<T>(name: string, value: T): void;
  /** Subscribe to any store change. Returns an unsubscribe function. For useSyncExternalStore. */
  subscribe(listener: () => void): () => void;
}
