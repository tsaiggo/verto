export interface StateStore {
  /** Synchronously read a named value from the store. Returns fallback on miss or parse error. */
  read<T>(name: string, fallback: T): T;
  /** Synchronously update the store; on desktop also queues an async write to .verto/. */
  write<T>(name: string, value: T): void;
  /** Subscribe to any store change. Returns an unsubscribe function. For useSyncExternalStore. */
  subscribe(listener: () => void): () => void;
}
