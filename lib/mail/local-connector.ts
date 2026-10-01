import type { MailConnection, MailConnector, MailMessage, MailPage, MailSyncPage } from "./model";
import type { LocalMailControl, LocalMailStatus, LocalMailStore } from "./local-types";
import { getLocalMailStore } from "./local-store";

interface LocalOptions {
  scope?: string;
  connected?: boolean;
  store?: LocalMailStore;
  onAuthenticationError?: (error: unknown) => void;
}

interface WriteQueue {
  tail: Promise<unknown>;
}
const storeQueues = new WeakMap<LocalMailStore, Map<string, WriteQueue>>();

function scopeWrites(store: LocalMailStore, scope: string): WriteQueue {
  let scopes = storeQueues.get(store);
  if (!scopes) {
    scopes = new Map();
    storeQueues.set(store, scopes);
  }
  let queue = scopes.get(scope);
  if (!queue) {
    queue = { tail: Promise.resolve() };
    scopes.set(scope, queue);
  }
  return queue;
}

function offline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function description(error: unknown): string {
  return error instanceof Error ? error.message : "Saved mail could not be updated. Try again.";
}

function localOffset(pageUrl?: string): number {
  if (!pageUrl) return 0;
  if (!/^local:\d+$/.test(pageUrl)) throw new Error("Refresh the saved mailbox to continue.");
  const value = Number(pageUrl.slice(6));
  if (!Number.isSafeInteger(value)) throw new Error("Refresh the saved mailbox to continue.");
  return value;
}

function authenticationError(error: unknown): boolean {
  const failure = error as { status?: number; code?: string } | null;
  if (
    failure?.code &&
    ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"].includes(failure.code)
  )
    return false;
  const status = failure?.status;
  return (
    status === 401 ||
    status === 403 ||
    /session expired|not connected|permission was not granted|access was denied/i.test(
      description(error)
    )
  );
}

class LocalMailbox {
  private live: boolean;
  private version = 0;
  private attempted = new Set<string>();
  private statuses = new Map<string, LocalMailStatus>();
  private listeners = new Set<() => void>();
  private pending = new Map<string, { done: Promise<void>; first: Promise<void> }>();
  private readonly store: LocalMailStore;
  private readonly writes: WriteQueue;
  readonly scope: string;

  constructor(
    private readonly remote: MailConnector,
    private readonly connection: MailConnection,
    private readonly options: LocalOptions
  ) {
    this.scope = options.scope ?? `${connection.account.provider}:${connection.account.id.trim()}`;
    this.store = options.store ?? getLocalMailStore();
    this.writes = scopeWrites(this.store, this.scope);
    this.live = options.connected !== false;
    const version = this.version;
    void this.write(version, () => this.store.saveConnection(this.scope, connection)).catch(
      (error) => {
        if (version !== this.version) return;
        for (const folder of connection.folders)
          this.statuses.set(folder.id, {
            phase: "error",
            count: 0,
            message: `Mail could not be saved on this browser. ${description(error)}`,
          });
        this.notify();
      }
    );
  }

  /** Serialize writes with clear, and reject stale work before it can recreate deleted records. */
  private write(version: number, operation: () => Promise<void>): Promise<void> {
    const pending = this.writes.tail.then(async () => {
      if (version === this.version) await operation();
    });
    this.writes.tail = pending.catch(() => undefined);
    return pending;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private status(folderId: string): LocalMailStatus {
    let status = this.statuses.get(folderId);
    if (!status) {
      status = { phase: offline() || !this.live ? "offline" : "idle", count: 0 };
      this.statuses.set(folderId, status);
    }
    return status;
  }

  private async update(folderId: string, patch: Partial<LocalMailStatus>, version = this.version) {
    const folder = await this.store.getFolder(this.scope, folderId);
    if (version !== this.version) return;
    this.statuses.set(folderId, {
      ...this.status(folderId),
      count: folder?.messageIds.length ?? 0,
      lastSyncedAt: folder?.lastSyncedAt,
      ...patch,
    });
    this.notify();
  }

  private requireOnline() {
    if (!this.live) throw new Error("Reconnect this account before syncing or sending mail.");
    if (offline()) throw new Error("You are offline. Connect to sync or send mail.");
  }

  private networkChanged = () => {
    for (const [folderId, status] of this.statuses) {
      this.statuses.set(folderId, {
        ...status,
        phase: offline() || !this.live ? "offline" : "idle",
        message: offline() ? "Offline · saved messages remain readable." : undefined,
      });
    }
    this.notify();
    if (!offline() && this.live)
      for (const folderId of this.attempted) void this.start(folderId).done.catch(() => undefined);
  };

  private start(folderId: string): { done: Promise<void>; first: Promise<void> } {
    const existing = this.pending.get(folderId);
    if (existing) return existing;
    let resolveFirst!: () => void;
    let rejectFirst!: (error: unknown) => void;
    const first = new Promise<void>((resolve, reject) => {
      resolveFirst = resolve;
      rejectFirst = reject;
    });
    // Cached-first callers don't await the first page, but failures still reach the status UI.
    void first.catch(() => undefined);
    const version = this.version;
    const round = { first, done: Promise.resolve() };
    this.pending.set(folderId, round);
    round.done = (async () => {
      try {
        this.requireOnline();
        await this.write(version, () => this.store.saveConnection(this.scope, this.connection));
        if (version !== this.version) return;
        const saved = await this.store.getFolder(this.scope, folderId);
        let pageUrl = saved?.nextPageUrl;
        const cursor = saved?.cursor;
        const visited = new Set<string>();
        await this.update(folderId, { phase: "syncing", message: undefined }, version);
        do {
          if (version !== this.version) return;
          this.requireOnline();
          const page = this.remote.syncFolder
            ? await this.remote.syncFolder(folderId, { cursor, pageUrl })
            : await this.snapshot(folderId, pageUrl);
          if (version !== this.version) return;
          if (page.nextPageUrl && visited.has(page.nextPageUrl))
            throw new Error("Mail returned a repeated sync page. Try again.");
          await this.write(version, () => this.store.applySyncPage(this.scope, folderId, page));
          if (version !== this.version) return;
          resolveFirst();
          await this.update(
            folderId,
            { phase: page.nextPageUrl ? "syncing" : "idle", message: undefined },
            version
          );
          pageUrl = page.nextPageUrl;
          if (pageUrl) visited.add(pageUrl);
        } while (pageUrl);
      } catch (error) {
        rejectFirst(error);
        if (version !== this.version) return;
        if (authenticationError(error)) {
          this.invalidate();
          this.options.onAuthenticationError?.(error);
        }
        try {
          await this.update(
            folderId,
            {
              phase: offline() || !this.live ? "offline" : "error",
              message: description(error),
            },
            authenticationError(error) ? this.version : version
          );
        } catch {
          if (version !== this.version) return;
          this.statuses.set(folderId, {
            ...this.status(folderId),
            phase: "error",
            message: `Mail could not be saved on this browser. ${description(error)}`,
          });
          this.notify();
        }
        throw error;
      } finally {
        resolveFirst();
        if (this.pending.get(folderId) === round) this.pending.delete(folderId);
      }
    })();
    void round.done.catch(() => undefined);
    return round;
  }

  private async snapshot(folderId: string, pageUrl?: string): Promise<MailSyncPage> {
    const page = await this.remote.listMessages(folderId, pageUrl);
    const messages: MailMessage[] = [];
    // The sample/legacy path also persists full bodies, with bounded parallel reads.
    for (let offset = 0; offset < page.messages.length; offset += 3) {
      messages.push(
        ...(await Promise.all(
          page.messages
            .slice(offset, offset + 3)
            .map((message) => this.remote.getMessage(message.id))
        ))
      );
    }
    return { messages, reset: !pageUrl, nextPageUrl: page.nextPageUrl };
  }

  private async listMessages(folderId: string, pageUrl?: string): Promise<MailPage> {
    const offset = localOffset(pageUrl);
    let cached: MailPage;
    try {
      cached = await this.store.listMessages(this.scope, folderId, offset);
    } catch (error) {
      this.statuses.set(folderId, {
        phase: "error",
        count: 0,
        message: `Mail could not be saved on this browser. ${description(error)}`,
      });
      this.notify();
      throw new Error(`Saved mail is unavailable on this browser. ${description(error)}`);
    }
    const saved = await this.store.getFolder(this.scope, folderId);
    if (!this.attempted.has(folderId) && this.live && !offline()) {
      this.attempted.add(folderId);
      const round = this.start(folderId);
      if (!saved) {
        await round.first;
        return this.store.listMessages(this.scope, folderId, offset);
      }
    }
    if (!this.pending.has(folderId))
      await this.update(folderId, {
        phase: offline() || !this.live ? "offline" : this.status(folderId).phase,
      });
    return cached;
  }

  private async getMessage(id: string): Promise<MailMessage> {
    const version = this.version;
    const saved = await this.store.getMessage(this.scope, id);
    if (version !== this.version)
      throw new Error("Saved mail changed. Open this message from the inbox again.");
    if (saved) return saved;
    this.requireOnline();
    const message = await this.remote.getMessage(id);
    if (version !== this.version)
      throw new Error("Saved mail changed. Open this message from the inbox again.");
    // Only a folder sync establishes membership. A deep link or moved message must
    // not guess a folder and reinsert mail that a delta round just removed.
    return message;
  }

  private async clear() {
    this.version += 1;
    this.pending.clear();
    this.attempted.clear();
    const version = this.version;
    await this.write(version, () => this.store.clearAccount(this.scope));
    if (version !== this.version) return;
    for (const folder of this.connection.folders)
      this.statuses.set(folder.id, { phase: "idle", count: 0, message: "Saved mail cleared." });
    this.notify();
  }

  private invalidate() {
    this.version += 1;
    this.pending.clear();
    this.live = false;
    this.networkChanged();
  }

  connector(): MailConnector {
    const local: LocalMailControl = {
      scope: this.scope,
      subscribe: (listener) => {
        if (!this.listeners.size && typeof window !== "undefined") {
          window.addEventListener("online", this.networkChanged);
          window.addEventListener("offline", this.networkChanged);
        }
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
          if (!this.listeners.size && typeof window !== "undefined") {
            window.removeEventListener("online", this.networkChanged);
            window.removeEventListener("offline", this.networkChanged);
          }
        };
      },
      getStatus: (folderId) => this.status(folderId),
      synchronize: (folderId) => this.start(folderId).done,
      search: (folderId, query, unreadOnly, pageUrl) =>
        this.store.search(this.scope, {
          folderId,
          query,
          unreadOnly,
          offset: localOffset(pageUrl),
        }),
      clear: () => this.clear(),
      invalidate: () => this.invalidate(),
    };
    return {
      ...this.remote,
      local,
      restore: async () => this.connection,
      disconnect: async () => {
        this.invalidate();
        await this.remote.disconnect();
      },
      listMessages: (folderId, pageUrl) => this.listMessages(folderId, pageUrl),
      getMessage: (id) => this.getMessage(id),
      ...(this.remote.enableSending && {
        enableSending: async () => {
          this.requireOnline();
          await this.remote.enableSending!();
        },
      }),
      ...(this.remote.sendMessage && {
        sendMessage: async (message: Parameters<NonNullable<MailConnector["sendMessage"]>>[0]) => {
          this.requireOnline();
          await this.remote.sendMessage!(message);
          for (const folder of this.connection.folders.filter((f) => f.kind === "sent"))
            void this.start(folder.id).done.catch(() => undefined);
        },
      }),
      ...(this.remote.getAttachment && {
        getAttachment: async (id, attachment) => {
          this.requireOnline();
          return this.remote.getAttachment!(id, attachment);
        },
      }),
    };
  }
}

/** Tokens remain in the provider connector; only mailbox data enters IndexedDB. */
export function createLocalMailConnector(
  remote: MailConnector,
  connection: MailConnection,
  options: LocalOptions = {}
): MailConnector {
  if (remote.local || (typeof indexedDB === "undefined" && !options.store)) return remote;
  return new LocalMailbox(remote, connection, options).connector();
}
