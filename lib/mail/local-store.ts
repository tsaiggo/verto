import type { LocalMailFolder, LocalMailSearch, LocalMailStore } from "./local-types";
import type {
  MailAccount,
  MailConnection,
  MailMessage,
  MailMessageSummary,
  MailPage,
  MailSyncPage,
} from "./model";

const DATABASE_NAME = "verto.mail.library";
const DATABASE_VERSION = 1;
const ACCOUNTS = "accounts";
const MESSAGES = "messages";
const FOLDERS = "folders";

interface AccountRecord {
  scope: string;
  connection: MailConnection;
  savedAt: number;
}

interface MessageRecord {
  scope: string;
  id: string;
  message: MailMessage;
}

function storageError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new Error("The local mail database could not complete this operation.");
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error));
  });
}

function requireId(value: string, name: string): void {
  if (typeof value !== "string" || !value.length)
    throw new Error(`A local mail ${name} is required.`);
}

function copyAccount(account: MailAccount): MailAccount {
  return {
    id: account.id,
    address: account.address,
    displayName: account.displayName,
    provider: account.provider,
  };
}

/** Only mail data is persisted, even if callers supply extra authentication fields. */
function copyConnection(connection: MailConnection): MailConnection {
  return {
    account: copyAccount(connection.account),
    folders: connection.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      kind: folder.kind,
      ...(folder.unreadCount === undefined ? {} : { unreadCount: folder.unreadCount }),
    })),
  };
}

function copyMessage(message: MailMessage): MailMessage {
  requireId(message.id, "message ID");
  if (typeof message.bodyText !== "string")
    throw new Error("A local mail message needs its full text body.");
  return {
    ...summary(message),
    to: [...message.to],
    bodyText: message.bodyText,
    ...(message.cc ? { cc: [...message.cc] } : {}),
    ...(message.replyTo ? { replyTo: [...message.replyTo] } : {}),
    ...(message.internetMessageId ? { internetMessageId: message.internetMessageId } : {}),
    ...(message.attachments
      ? {
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
          })),
        }
      : {}),
  };
}

function summary(message: MailMessage): MailMessageSummary {
  return {
    id: message.id,
    subject: message.subject,
    from: message.from,
    receivedAt: message.receivedAt,
    preview: message.preview,
    isRead: message.isRead,
    hasAttachments: message.hasAttachments,
    ...(message.mailAccount ? { mailAccount: copyAccount(message.mailAccount) } : {}),
    ...(message.sourceMessageId ? { sourceMessageId: message.sourceMessageId } : {}),
  };
}

function normalizedText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function pageOf(messages: MailMessage[], offset = 0, limit = 50): MailPage {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit <= 0) {
    throw new Error("Invalid local mail pagination: offset >= 0 and integer limit > 0 required.");
  }
  messages.sort((a, b) => {
    const aTime = Date.parse(a.receivedAt) || 0;
    const bTime = Date.parse(b.receivedAt) || 0;
    return bTime - aTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  const end = offset + limit;
  return {
    messages: messages.slice(offset, end).map(summary),
    ...(end < messages.length ? { nextPageUrl: `local:${end}` } : {}),
  };
}

function membership(folders: LocalMailFolder[]): Set<string> {
  return new Set(folders.flatMap((folder) => folder.messageIds));
}

class IndexedMailStore implements LocalMailStore {
  private database: IDBDatabase | undefined;
  private opening: Promise<IDBDatabase> | undefined;

  private open(): Promise<IDBDatabase> {
    if (this.database) return Promise.resolve(this.database);
    if (this.opening) return this.opening;
    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof globalThis.indexedDB === "undefined") {
        reject(new Error("Persistent local mail storage is unavailable in this browser."));
        return;
      }
      let request: IDBOpenDBRequest;
      try {
        request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        reject(storageError(error));
        return;
      }
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        try {
          db.createObjectStore(ACCOUNTS, { keyPath: "scope" });
          const messages = db.createObjectStore(MESSAGES, { keyPath: ["scope", "id"] });
          messages.createIndex("scope", "scope");
          const folders = db.createObjectStore(FOLDERS, { keyPath: ["scope", "folderId"] });
          folders.createIndex("scope", "scope");
        } catch (error) {
          settled = true;
          request.transaction?.abort();
          reject(storageError(error));
        }
      };
      request.onblocked = () => {
        settled = true;
        reject(new Error("Local mail storage is blocked. Close other mail windows and retry."));
      };
      request.onerror = () => {
        settled = true;
        reject(storageError(request.error));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        this.database = db;
        db.onversionchange = () => {
          db.close();
          if (this.database === db) this.database = undefined;
        };
        db.onclose = () => {
          if (this.database === db) this.database = undefined;
        };
        resolve(db);
      };
    }).finally(() => {
      this.opening = undefined;
    });
    return this.opening;
  }

  private async transaction<T>(
    stores: string[],
    mode: IDBTransactionMode,
    operation: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(stores, mode);
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(storageError(failure ?? tx.error));
      const execute = async () => operation(tx);
      execute().then(
        (value) => {
          result = value;
        },
        (error) => {
          failure = error;
          try {
            tx.abort();
          } catch {
            reject(storageError(error));
          }
        }
      );
    });
  }

  private scopedFolders(tx: IDBTransaction, scope: string): Promise<LocalMailFolder[]> {
    return requestValue(tx.objectStore(FOLDERS).index("scope").getAll(scope));
  }

  private scopedMessages(tx: IDBTransaction, scope: string): Promise<MessageRecord[]> {
    return requestValue(tx.objectStore(MESSAGES).index("scope").getAll(scope));
  }

  private async writeMessages(tx: IDBTransaction, scope: string, messages: MailMessage[]) {
    const store = tx.objectStore(MESSAGES);
    await Promise.all(
      messages.map(async (message) => requestValue(store.put({ scope, id: message.id, message })))
    );
  }

  private async removeOrphans(tx: IDBTransaction, scope: string, candidates: Set<string>) {
    if (!candidates.size) return;
    const retained = membership(await this.scopedFolders(tx, scope));
    const store = tx.objectStore(MESSAGES);
    await Promise.all(
      [...candidates]
        .filter((id) => !retained.has(id))
        .map(async (id) => requestValue(store.delete([scope, id])))
    );
  }

  async saveConnection(scope: string, connection: MailConnection) {
    requireId(scope, "account scope");
    const record: AccountRecord = {
      scope,
      connection: copyConnection(connection),
      savedAt: Date.now(),
    };
    await this.transaction([ACCOUNTS], "readwrite", async (tx) => {
      await requestValue(tx.objectStore(ACCOUNTS).put(record));
    });
  }

  async listAccounts() {
    return this.transaction([ACCOUNTS, FOLDERS], "readonly", async (tx) => {
      const [accounts, folders] = await Promise.all([
        requestValue<AccountRecord[]>(tx.objectStore(ACCOUNTS).getAll()),
        requestValue<LocalMailFolder[]>(tx.objectStore(FOLDERS).getAll()),
      ]);
      return accounts
        .map((account) => ({
          ...account,
          messageCount: membership(folders.filter((folder) => folder.scope === account.scope)).size,
        }))
        .sort(
          (a, b) => b.savedAt - a.savedAt || (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0)
        );
    });
  }

  async getConnection(scope: string) {
    requireId(scope, "account scope");
    return this.transaction([ACCOUNTS], "readonly", async (tx) => {
      const record = await requestValue<AccountRecord | undefined>(
        tx.objectStore(ACCOUNTS).get(scope)
      );
      return record?.connection;
    });
  }

  async getFolder(scope: string, folderId: string) {
    requireId(scope, "account scope");
    requireId(folderId, "folder ID");
    return this.transaction([FOLDERS], "readonly", (tx) =>
      requestValue<LocalMailFolder | undefined>(tx.objectStore(FOLDERS).get([scope, folderId]))
    );
  }

  async applySyncPage(scope: string, folderId: string, page: MailSyncPage) {
    requireId(scope, "account scope");
    requireId(folderId, "folder ID");
    const messages = page.messages.map(copyMessage);
    await this.transaction([FOLDERS, MESSAGES], "readwrite", async (tx) => {
      const store = tx.objectStore(FOLDERS);
      const folder: LocalMailFolder = (await requestValue(store.get([scope, folderId]))) ?? {
        scope,
        folderId,
        messageIds: [],
      };
      const ids = new Set(folder.messageIds);
      const replacing = page.reset || folder.replacementIds !== undefined;
      const replacement = new Set(page.reset ? [] : folder.replacementIds);
      const removed = new Set(page.removedIds ?? []);
      for (const message of messages) {
        ids.add(message.id);
        if (replacing) replacement.add(message.id);
      }
      for (const id of removed) {
        ids.delete(id);
        replacement.delete(id);
      }
      await this.writeMessages(tx, scope, messages);
      folder.messageIds = [...ids];
      if (page.nextPageUrl) {
        folder.nextPageUrl = page.nextPageUrl;
        if (replacing) folder.replacementIds = [...replacement];
      } else {
        if (replacing) {
          for (const id of ids) if (!replacement.has(id)) removed.add(id);
          folder.messageIds = [...replacement];
        }
        delete folder.replacementIds;
        delete folder.nextPageUrl;
        if (page.cursor !== undefined) folder.cursor = page.cursor;
        folder.lastSyncedAt = Date.now();
      }
      await requestValue(store.put(folder));
      await this.removeOrphans(tx, scope, removed);
    });
  }

  async saveMessages(scope: string, folderId: string, messages: MailMessage[]) {
    requireId(scope, "account scope");
    requireId(folderId, "folder ID");
    const copied = messages.map(copyMessage);
    await this.transaction([FOLDERS, MESSAGES], "readwrite", async (tx) => {
      const store = tx.objectStore(FOLDERS);
      const folder: LocalMailFolder = (await requestValue(store.get([scope, folderId]))) ?? {
        scope,
        folderId,
        messageIds: [],
      };
      folder.messageIds = [
        ...new Set([...folder.messageIds, ...copied.map((message) => message.id)]),
      ];
      await this.writeMessages(tx, scope, copied);
      await requestValue(store.put(folder));
    });
  }

  async listMessages(scope: string, folderId: string, offset?: number, limit?: number) {
    requireId(scope, "account scope");
    requireId(folderId, "folder ID");
    return this.transaction([FOLDERS, MESSAGES], "readonly", async (tx) => {
      const folder = await requestValue<LocalMailFolder | undefined>(
        tx.objectStore(FOLDERS).get([scope, folderId])
      );
      const store = tx.objectStore(MESSAGES);
      const records = await Promise.all(
        (folder?.messageIds ?? []).map((id) =>
          requestValue<MessageRecord | undefined>(store.get([scope, id]))
        )
      );
      return pageOf(
        records.flatMap((record) => (record ? [record.message] : [])),
        offset,
        limit
      );
    });
  }

  async getMessage(scope: string, id: string) {
    requireId(scope, "account scope");
    requireId(id, "message ID");
    return this.transaction([FOLDERS, MESSAGES], "readonly", async (tx) => {
      const [folders, record] = await Promise.all([
        this.scopedFolders(tx, scope),
        requestValue<MessageRecord | undefined>(tx.objectStore(MESSAGES).get([scope, id])),
      ]);
      return membership(folders).has(id) ? record?.message : undefined;
    });
  }

  async search(scope: string, options: LocalMailSearch) {
    requireId(scope, "account scope");
    const terms = normalizedText(options.query).trim().split(/\s+/u).filter(Boolean);
    return this.transaction([FOLDERS, MESSAGES], "readonly", async (tx) => {
      const [folders, records] = await Promise.all([
        this.scopedFolders(tx, scope),
        this.scopedMessages(tx, scope),
      ]);
      const ids = membership(
        options.folderId === undefined
          ? folders
          : folders.filter((folder) => folder.folderId === options.folderId)
      );
      const matches = records.filter(({ id, message }) => {
        if (!ids.has(id) || (options.unreadOnly && message.isRead)) return false;
        const text = normalizedText(
          [
            message.subject,
            message.from,
            ...message.to,
            ...(message.cc ?? []),
            message.bodyText,
          ].join("\n")
        );
        return terms.every((term) => text.includes(term));
      });
      return pageOf(
        matches.map((record) => record.message),
        options.offset,
        options.limit
      );
    });
  }

  async clearAccount(scope: string) {
    requireId(scope, "account scope");
    await this.transaction([ACCOUNTS, FOLDERS, MESSAGES], "readwrite", async (tx) => {
      const accounts = requestValue(tx.objectStore(ACCOUNTS).delete(scope));
      const clearStore = async (name: string) => {
        const store = tx.objectStore(name);
        const keys = await requestValue(store.index("scope").getAllKeys(scope));
        await Promise.all(keys.map(async (key) => requestValue(store.delete(key))));
      };
      await Promise.all([accounts, clearStore(FOLDERS), clearStore(MESSAGES)]);
    });
  }
}

export function createLocalMailStore(): LocalMailStore {
  return new IndexedMailStore();
}

let localMailStore: LocalMailStore | undefined;

export function getLocalMailStore(): LocalMailStore {
  return (localMailStore ??= createLocalMailStore());
}
