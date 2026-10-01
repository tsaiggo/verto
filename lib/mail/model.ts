import type { LocalMailControl } from "./local-types";

export type MailProviderId = "google" | "microsoft";

export interface MailAccount {
  id: string;
  address: string;
  displayName: string;
  provider: MailProviderId;
}

export interface MailFolder {
  id: string;
  name: string;
  kind: "inbox" | "sent" | "drafts" | "archive" | "trash" | "custom";
  unreadCount?: number;
}

export interface MailMessageSummary {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  /** Present only in a combined inbox; provider IDs remain scoped to their account. */
  mailAccount?: MailAccount;
  sourceMessageId?: string;
}

export interface MailMessage extends MailMessageSummary {
  to: string[];
  cc?: string[];
  replyTo?: string[];
  internetMessageId?: string;
  attachments?: MailAttachment[];
  bodyText: string;
}

export interface MailAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface MailOutgoing {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyText: string;
  replyToMessageId?: string;
  internetMessageId?: string;
}

export interface MailConnection {
  account: MailAccount;
  folders: MailFolder[];
}

export interface MailPage {
  messages: MailMessageSummary[];
  nextPageUrl?: string;
  accountWarnings?: { accountId: string; address: string; message: string }[];
}

export interface MailSyncRequest {
  /** Last completed provider change cursor. */
  cursor?: string;
  /** Continuation of an interrupted initial or incremental round. */
  pageUrl?: string;
}

export interface MailSyncPage {
  messages: MailMessage[];
  /** Remove membership in this folder, without removing other folder copies. */
  removedIds?: string[];
  /** Starts a replacement snapshot; old cached membership stays until completion. */
  reset?: boolean;
  nextPageUrl?: string;
  /** Only advance after a complete round has been stored successfully. */
  cursor?: string;
}

export interface MailConnector {
  readonly id: MailProviderId;
  readonly label: string;
  readonly local?: LocalMailControl;
  isConfigured(): boolean;
  connect(): Promise<void>;
  restore(): Promise<MailConnection | null>;
  disconnect(): Promise<void>;
  listMessages(folderId: string, pageUrl?: string): Promise<MailPage>;
  getMessage(id: string): Promise<MailMessage>;
  enableSending?(): Promise<void>;
  sendMessage?(message: MailOutgoing): Promise<void>;
  getAttachment?(messageId: string, attachment: MailAttachment): Promise<Blob>;
  syncFolder?(folderId: string, request?: MailSyncRequest): Promise<MailSyncPage>;
}
