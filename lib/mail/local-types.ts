import type {
  MailConnection,
  MailMessage,
  MailMutationResult,
  MailPage,
  MailSyncPage,
} from "./model";

export interface LocalMailVersion {
  /** Only clearing the cache changes generation. */
  generation: number;
  /** Confirmed mutations and clearing invalidate previously fetched sync pages. */
  revision: number;
}

export interface LocalMailFolder {
  scope: string;
  folderId: string;
  messageIds: string[];
  cursor?: string;
  nextPageUrl?: string;
  replacementIds?: string[];
  lastSyncedAt?: number;
}

export interface LocalMailSnapshot {
  connection: MailConnection;
  savedAt: number;
  messageCount: number;
}

export interface LocalMailSearch {
  folderId?: string;
  query: string;
  unreadOnly?: boolean;
  offset?: number;
  limit?: number;
}

/** Every method is scoped; demo scopes start with demo: and never restore as real accounts. */
export interface LocalMailStore {
  saveConnection(
    scope: string,
    connection: MailConnection,
    expectedGeneration?: number
  ): Promise<void>;
  getVersion(scope: string): Promise<LocalMailVersion>;
  /** Claim one message before changing it on the provider; only the owner may renew/release. */
  claimMutation(
    scope: string,
    id: string,
    owner: string,
    expiresAt: number,
    expectedGeneration?: number
  ): Promise<boolean>;
  releaseMutation(scope: string, id: string, owner: string): Promise<void>;
  listAccounts(): Promise<Array<LocalMailSnapshot & { scope: string }>>;
  getConnection(scope: string): Promise<MailConnection | undefined>;
  getFolder(scope: string, folderId: string): Promise<LocalMailFolder | undefined>;
  applySyncPage(
    scope: string,
    folderId: string,
    page: MailSyncPage,
    expectedVersion?: LocalMailVersion
  ): Promise<void>;
  applyMutation(
    scope: string,
    originalId: string,
    result: MailMutationResult,
    expectedGeneration?: number,
    expectedOwner?: string
  ): Promise<LocalMailVersion>;
  saveMessages(scope: string, folderId: string, messages: MailMessage[]): Promise<void>;
  listMessages(scope: string, folderId: string, offset?: number, limit?: number): Promise<MailPage>;
  getMessage(scope: string, id: string): Promise<MailMessage | undefined>;
  search(scope: string, options: LocalMailSearch): Promise<MailPage>;
  clearAccount(scope: string): Promise<LocalMailVersion>;
}

export interface LocalMailStatus {
  phase: "idle" | "syncing" | "offline" | "error";
  count: number;
  lastSyncedAt?: number;
  message?: string;
}

export interface LocalMailControl {
  readonly scope: string;
  subscribe(listener: () => void): () => void;
  getStatus(folderId: string): LocalMailStatus;
  getConnection?(): Promise<MailConnection | undefined>;
  synchronize(folderId: string): Promise<void>;
  search(
    folderId: string | undefined,
    query: string,
    unreadOnly?: boolean,
    pageUrl?: string
  ): Promise<MailPage>;
  clear(): Promise<void>;
  /** Retire pending work when a session replaces this connector, without revoking a new grant. */
  invalidate?(): void;
}
