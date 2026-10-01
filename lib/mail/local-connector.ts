import type {
  MailConnection,
  MailConnector,
  MailMessage,
  MailMessageAction,
  MailMutationResult,
  MailPage,
  MailSyncPage,
} from "./model";
import type {
  LocalMailControl,
  LocalMailStatus,
  LocalMailStore,
  LocalMailVersion,
} from "./local-types";
import { getLocalMailStore } from "./local-store";

interface LocalOptions {
  scope?: string;
  connected?: boolean;
  store?: LocalMailStore;
  onAuthenticationError?: (error: unknown) => void;
}

interface WriteQueue {
  tail: Promise<unknown>;
  actions: Map<string, Promise<MailMutationResult>>;
}
interface SyncRound {
  done: Promise<void>;
  first: Promise<void>;
}
const storeQueues = new WeakMap<LocalMailStore, Map<string, WriteQueue>>();
const mutationLeaseDuration = 10 * 60 * 1000;
const changeChannelName = "verto.mail.library.changes";
interface MailChange {
  scope: string;
  type: "mutation" | "clear";
  version: LocalMailVersion;
  source: string;
}
const changeListeners = new Map<string, Set<(change: MailChange) => void>>();

function newerVersion(next: LocalMailVersion, previous: LocalMailVersion): boolean {
  return (
    next.generation > previous.generation ||
    (next.generation === previous.generation && next.revision > previous.revision)
  );
}

function mailChange(value: unknown): value is MailChange {
  const change = value as Partial<MailChange> | null;
  return (
    !!change &&
    typeof change.scope === "string" &&
    typeof change.source === "string" &&
    (change.type === "mutation" || change.type === "clear") &&
    !!change.version &&
    Number.isSafeInteger(change.version.generation) &&
    change.version.generation >= 0 &&
    Number.isSafeInteger(change.version.revision) &&
    change.version.revision >= 0
  );
}

function scopeWrites(store: LocalMailStore, scope: string): WriteQueue {
  let scopes = storeQueues.get(store);
  if (!scopes) {
    scopes = new Map();
    storeQueues.set(store, scopes);
  }
  let queue = scopes.get(scope);
  if (!queue) {
    queue = { tail: Promise.resolve(), actions: new Map() };
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

function authenticationError(error: unknown, capability = false): boolean {
  const failure = error as { status?: number; code?: string } | null;
  if (
    failure?.code &&
    ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"].includes(failure.code)
  )
    return false;
  const status = failure?.status;
  if (
    status !== 401 &&
    ((capability && status === 403) ||
      /update permission|send permission|enable.*(?:updating|sending)|cancelled/i.test(
        description(error)
      ))
  )
    return false;
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
  private lifetime = 0;
  private cleared = false;
  private knownVersion: LocalMailVersion = { generation: 0, revision: 0 };
  private readonly source = `${Date.now()}:${Math.random()}`;
  private channel?: BroadcastChannel;
  private attempted = new Set<string>();
  private opened = new Set<string>();
  private statuses = new Map<string, LocalMailStatus>();
  private listeners = new Set<() => void>();
  private pending = new Map<string, SyncRound>();
  private recoveries = new Map<
    string,
    { round: SyncRound; version: number; lifetime: number; recovering: boolean }
  >();
  private readonly store: LocalMailStore;
  private readonly writes: WriteQueue;
  private readonly ready: Promise<void>;
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
    const store = this.store;
    const scope = this.scope;
    this.ready = (async () => {
      const saved = await store.getVersion(scope);
      await this.write(version, () => store.saveConnection(scope, connection, saved.generation));
      this.observeVersion(await store.getVersion(scope));
    })();
    void this.ready.catch((error) => {
      if (version !== this.version) return;
      for (const folder of connection.folders)
        this.statuses.set(folder.id, {
          phase: "error",
          count: 0,
          message: `Mail could not be saved on this browser. ${description(error)}`,
        });
      this.notify();
    });
  }

  /** Serialize writes with clear, and reject stale work before it can recreate deleted records. */
  private write(version: number, operation: () => Promise<void>): Promise<void> {
    return this.queuedWrite(() => version === this.version, operation);
  }

  private queuedWrite(current: () => boolean, operation: () => Promise<void>): Promise<void> {
    const pending = this.writes.tail.then(async () => {
      if (current()) await operation();
    });
    this.writes.tail = pending.catch(() => undefined);
    return pending;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private observeVersion(version: LocalMailVersion) {
    if (newerVersion(version, this.knownVersion)) this.knownVersion = version;
  }

  private receiveChange = (change: MailChange) => {
    if (
      change.scope !== this.scope ||
      change.source === this.source ||
      !newerVersion(change.version, this.knownVersion)
    )
      return;
    this.observeVersion(change.version);
    this.version += 1;
    this.pending.clear();
    this.recoveries.clear();
    if (change.type === "clear") {
      this.lifetime += 1;
      this.cleared = true;
      this.opened.clear();
      this.attempted = new Set(this.connection.folders.map((folder) => folder.id));
      for (const folder of this.connection.folders)
        this.statuses.set(folder.id, { phase: "idle", count: 0, message: "Saved mail cleared." });
      this.notify();
    }
    const version = this.version;
    void (async () => {
      const connection = await this.store.getConnection(this.scope);
      if (version !== this.version) return;
      if (connection) this.connection.folders = connection.folders;
      for (const folder of this.connection.folders)
        await this.update(
          folder.id,
          {
            phase: this.live && !offline() ? "idle" : "offline",
            message: change.type === "clear" ? "Saved mail cleared." : undefined,
          },
          version
        );
    })().catch((error) => {
      if (version !== this.version) return;
      for (const folder of this.connection.folders)
        this.statuses.set(folder.id, {
          ...this.status(folder.id),
          phase: "error",
          message: description(error),
        });
      this.notify();
    });
  };

  private attachChanges() {
    let listeners = changeListeners.get(this.scope);
    if (!listeners) changeListeners.set(this.scope, (listeners = new Set()));
    listeners.add(this.receiveChange);
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(changeChannelName);
        this.channel.addEventListener("message", this.channelChanged);
      } catch {
        /* Runtime notifications remain available if the browser blocks the channel. */
      }
    }
  }

  private channelChanged = (event: MessageEvent<unknown>) => {
    if (mailChange(event.data)) this.receiveChange(event.data);
  };

  private detachChanges() {
    const listeners = changeListeners.get(this.scope);
    listeners?.delete(this.receiveChange);
    if (!listeners?.size) changeListeners.delete(this.scope);
    this.channel?.removeEventListener("message", this.channelChanged);
    this.channel?.close();
    this.channel = undefined;
  }

  private publishChange(type: MailChange["type"], version: LocalMailVersion) {
    this.observeVersion(version);
    const change: MailChange = { scope: this.scope, type, version, source: this.source };
    for (const listener of changeListeners.get(this.scope) ?? []) listener(change);
    try {
      if (this.channel) this.channel.postMessage(change);
      else if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(changeChannelName);
        channel.postMessage(change);
        channel.close();
      }
    } catch {
      /* IndexedDB remains authoritative when notification delivery is unavailable. */
    }
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
    if (offline()) this.recoveries.clear();
    for (const [folderId, status] of this.statuses) {
      this.statuses.set(folderId, {
        ...status,
        phase: offline() || !this.live ? "offline" : "idle",
        message: this.cleared
          ? "Saved mail cleared."
          : offline()
            ? "Offline · saved messages remain readable."
            : undefined,
      });
    }
    this.notify();
    if (!offline() && this.live && !this.cleared)
      for (const folderId of this.opened) this.recover(folderId);
  };

  private recover(folderId: string) {
    this.attempted.add(folderId);
    const round = this.pending.get(folderId);
    const queued = this.recoveries.get(folderId);
    if (queued?.recovering || (round && queued?.round === round)) return;
    if (!round) {
      const recovery = {
        round: this.start(folderId),
        version: this.version,
        lifetime: this.lifetime,
        recovering: true,
      };
      this.recoveries.set(folderId, recovery);
      void recovery.round.done
        .catch(() => undefined)
        .then(() => {
          if (this.recoveries.get(folderId) === recovery) this.recoveries.delete(folderId);
        });
      return;
    }
    const recovery = { round, version: this.version, lifetime: this.lifetime, recovering: false };
    this.recoveries.set(folderId, recovery);
    // A failed round may still be persisting its status when connectivity returns.
    // Retry once after cleanup; repeated online events share this queued recovery.
    void round.done
      .catch(() => undefined)
      .then(() => {
        if (this.recoveries.get(folderId) !== recovery) return;
        if (
          recovery.version !== this.version ||
          recovery.lifetime !== this.lifetime ||
          !this.live ||
          offline() ||
          this.cleared ||
          !this.opened.has(folderId)
        ) {
          this.recoveries.delete(folderId);
          return;
        }
        recovery.recovering = true;
        recovery.round = this.start(folderId);
        void recovery.round.done
          .catch(() => undefined)
          .then(() => {
            if (this.recoveries.get(folderId) === recovery) this.recoveries.delete(folderId);
          });
      });
  }

  private start(folderId: string): SyncRound {
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
        await this.ready;
        if (version !== this.version) return;
        const durableVersion = await this.store.getVersion(this.scope);
        this.observeVersion(durableVersion);
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
          await this.write(version, () =>
            this.store.applySyncPage(this.scope, folderId, page, durableVersion)
          );
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
    if (this.live && !this.cleared) this.opened.add(folderId);
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
    const durableVersion = await this.store.getVersion(this.scope);
    this.observeVersion(durableVersion);
    const version = this.version;
    const saved = await this.store.getMessage(this.scope, id);
    if (version !== this.version)
      throw new Error("Saved mail changed. Open this message from the inbox again.");
    if (saved) return saved;
    this.requireOnline();
    const message = await this.remote.getMessage(id);
    const current = await this.store.getVersion(this.scope);
    if (
      version !== this.version ||
      current.generation !== durableVersion.generation ||
      current.revision !== durableVersion.revision
    )
      throw new Error("Saved mail changed. Open this message from the inbox again.");
    // Only a folder sync establishes membership. A deep link or moved message must
    // not guess a folder and reinsert mail that a delta round just removed.
    return message;
  }

  private async clear() {
    this.version += 1;
    this.lifetime += 1;
    this.pending.clear();
    this.recoveries.clear();
    this.opened.clear();
    this.cleared = true;
    this.attempted = new Set(this.connection.folders.map((folder) => folder.id));
    const version = this.version;
    let committed: LocalMailVersion | undefined;
    await this.write(version, async () => {
      committed = await this.store.clearAccount(this.scope);
    });
    if (committed) this.publishChange("clear", committed);
    if (version !== this.version) return;
    for (const folder of this.connection.folders)
      this.statuses.set(folder.id, { phase: "idle", count: 0, message: "Saved mail cleared." });
    this.notify();
  }

  private invalidate() {
    this.version += 1;
    this.lifetime += 1;
    this.pending.clear();
    this.recoveries.clear();
    this.opened.clear();
    this.live = false;
    this.networkChanged();
  }

  private async mutateMessage(id: string, action: MailMessageAction): Promise<MailMutationResult> {
    this.requireOnline();
    const lifetime = this.lifetime;
    await this.ready;
    const saved = await this.store.getVersion(this.scope);
    const earlier = this.writes.actions.get(id);
    const pending = (async () => {
      await earlier?.catch(() => undefined);
      if (lifetime !== this.lifetime)
        throw new Error("Saved mail changed. Open this message again.");
      this.requireOnline();
      if ((await this.store.getVersion(this.scope)).generation !== saved.generation)
        throw new Error("Saved mail changed. Open this message again.");
      let confirmed = false;
      let claimed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const owner = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`;
      try {
        claimed = await this.store.claimMutation(
          this.scope,
          id,
          owner,
          Date.now() + mutationLeaseDuration,
          saved.generation
        );
        if (!claimed)
          throw new Error(
            "This message is being updated in another mail window. Wait for the result before trying again."
          );
        if (lifetime !== this.lifetime)
          throw new Error("Saved mail changed. Open this message again.");
        heartbeat = setInterval(() => {
          if (lifetime !== this.lifetime) return;
          void this.store
            .claimMutation(
              this.scope,
              id,
              owner,
              Date.now() + mutationLeaseDuration,
              saved.generation
            )
            .catch(() => undefined);
        }, 30_000);
        const result = await this.remote.mutateMessage!(id, action);
        confirmed = true;
        if (lifetime !== this.lifetime)
          throw new Error("Saved mail changed. Open this message again.");
        // Cancel pages and detail reads fetched before the server confirmed this action.
        this.version += 1;
        this.pending.clear();
        let committed: LocalMailVersion | undefined;
        await this.queuedWrite(
          () => lifetime === this.lifetime,
          async () => {
            committed = await this.store.applyMutation(
              this.scope,
              id,
              result,
              saved.generation,
              owner
            );
          }
        );
        if (committed) this.publishChange("mutation", committed);
        if (lifetime !== this.lifetime)
          throw new Error("Saved mail changed. Open this message again.");
        const connection = await this.store.getConnection(this.scope);
        if (connection) this.connection.folders = connection.folders;
        for (const folder of this.connection.folders)
          await this.update(folder.id, { phase: "idle", message: undefined });
        return result;
      } catch (cause) {
        if (lifetime !== this.lifetime) throw cause;
        const error = confirmed
          ? new Error(
              `Mail was updated on the provider, but could not be saved here. Sync again. ${description(cause)}`
            )
          : cause;
        if (authenticationError(error, true)) {
          this.invalidate();
          this.options.onAuthenticationError?.(error);
        }
        for (const folder of this.connection.folders) {
          try {
            await this.update(folder.id, {
              phase: this.live && !offline() ? "error" : "offline",
              message: description(error),
            });
          } catch {
            this.statuses.set(folder.id, {
              ...this.status(folder.id),
              phase: "error",
              message: description(error),
            });
          }
        }
        this.notify();
        throw error;
      } finally {
        if (heartbeat !== undefined) clearInterval(heartbeat);
        if (claimed) await this.store.releaseMutation(this.scope, id, owner).catch(() => undefined);
      }
    })();
    this.writes.actions.set(id, pending);
    try {
      return await pending;
    } finally {
      if (this.writes.actions.get(id) === pending) this.writes.actions.delete(id);
    }
  }

  connector(): MailConnector {
    const local: LocalMailControl = {
      scope: this.scope,
      subscribe: (listener) => {
        if (!this.listeners.size) {
          this.attachChanges();
          if (typeof window !== "undefined") {
            window.addEventListener("online", this.networkChanged);
            window.addEventListener("offline", this.networkChanged);
          }
        }
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
          if (!this.listeners.size) {
            this.detachChanges();
            if (typeof window !== "undefined") {
              window.removeEventListener("online", this.networkChanged);
              window.removeEventListener("offline", this.networkChanged);
            }
          }
        };
      },
      getStatus: (folderId) => this.status(folderId),
      getConnection: () => this.store.getConnection(this.scope),
      synchronize: (folderId) => {
        this.cleared = false;
        if (this.live) this.opened.add(folderId);
        this.attempted.add(folderId);
        return this.start(folderId).done;
      },
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
      ...(this.remote.enableUpdating && {
        enableUpdating: async (id?: string) => {
          this.requireOnline();
          try {
            await this.remote.enableUpdating!(id);
          } catch (error) {
            if (authenticationError(error, true)) {
              this.invalidate();
              this.options.onAuthenticationError?.(error);
            }
            throw error;
          }
        },
      }),
      ...(this.remote.mutateMessage && {
        mutateMessage: (id, action) => this.mutateMessage(id, action),
      }),
      ...(this.remote.enableSending && {
        enableSending: async () => {
          this.requireOnline();
          try {
            await this.remote.enableSending!();
          } catch (error) {
            if (authenticationError(error, true)) {
              this.invalidate();
              this.options.onAuthenticationError?.(error);
            }
            throw error;
          }
        },
      }),
      ...(this.remote.sendMessage && {
        sendMessage: async (message: Parameters<NonNullable<MailConnector["sendMessage"]>>[0]) => {
          this.requireOnline();
          const version = this.version;
          try {
            await this.remote.sendMessage!(message);
          } catch (error) {
            if (authenticationError(error, true)) {
              this.invalidate();
              this.options.onAuthenticationError?.(error);
            }
            throw error;
          }
          if (!this.cleared && version === this.version)
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
