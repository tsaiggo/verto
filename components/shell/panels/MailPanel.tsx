"use client";

import Link from "@/components/mail/MailViewLink";
import { useSearchParams } from "next/navigation";
import { Archive, FilePenLine, Folder, Inbox, Mail, PanelLeft, Send, Trash2 } from "lucide-react";
import type { MailFolder } from "@/lib/mail/model";
import { useMailSession } from "@/lib/mail/session";
import { demoMailAccounts } from "@/lib/mail/demo";
import { brandDemoMailAccounts } from "@/lib/mail/demo-brands";
import { unifiedMailConnection } from "@/lib/mail/unified";
import { mailHref } from "@/lib/mail/view-state";
import styles from "./MailPanel.module.css";

const folderIcons = {
  inbox: Inbox,
  sent: Send,
  drafts: FilePenLine,
  archive: Archive,
  trash: Trash2,
  custom: Folder,
} satisfies Record<MailFolder["kind"], typeof Inbox>;

export default function MailPanel({ onCollapse }: { onCollapse?: () => void }) {
  const session = useMailSession();
  const searchParams = useSearchParams();
  const demo = searchParams?.get("demo") === "1";
  const local = searchParams?.get("local") === "1";
  const preview = demo && searchParams?.get("preview") === "brands" ? "brands" : undefined;
  const requestedAccount = searchParams?.get("account") ?? undefined;
  const accounts = demo ? (preview ? brandDemoMailAccounts : demoMailAccounts) : session.accounts;
  const all = (requestedAccount ?? session.activeAccountId) === "all" && accounts.length > 1;
  const selectedAccount =
    accounts.find((entry) => entry.id === requestedAccount) ??
    accounts.find((entry) => entry.id === session.activeAccountId) ??
    accounts[0];
  const connection = all ? unifiedMailConnection(accounts) : (selectedAccount?.connection ?? null);
  const requestedFolder = searchParams?.get("folder");
  const selectedFolder =
    connection?.folders.find((folder) => folder.id === requestedFolder)?.id ??
    connection?.folders.find((folder) => folder.kind === "inbox")?.id;

  return (
    <div className={styles.panel} data-testid="workspace-mail-panel">
      <header className={styles.header}>
        <div className={styles.heading}>
          <Mail aria-hidden="true" />
          <strong>Mail</strong>
        </div>
        {onCollapse && (
          <button
            type="button"
            className={styles.collapse}
            aria-label="Collapse sidebar"
            onClick={onCollapse}
          >
            <PanelLeft aria-hidden="true" />
          </button>
        )}
      </header>

      {connection ? (
        <>
          <div className={styles.account} title={connection.account.address}>
            <span className={styles.accountProvider}>
              {all
                ? `${accounts.length} ${demo ? "sample " : ""}accounts`
                : demo
                  ? preview
                    ? "Brand preview"
                    : "Sample inbox"
                  : connection.account.provider === "google"
                    ? "Gmail"
                    : "Outlook"}
            </span>
            <span className={styles.accountName}>{connection.account.displayName}</span>
            {!all && connection.account.displayName !== connection.account.address && (
              <span className={styles.accountAddress}>{connection.account.address}</span>
            )}
          </div>
          <nav className={styles.folders} aria-label="Mail folders">
            <span className={styles.sectionLabel}>Folders</span>
            {connection.folders.map((folder) => {
              const active = folder.id === selectedFolder;
              const Icon = folderIcons[folder.kind];
              return (
                <Link
                  key={folder.id}
                  href={mailHref({
                    demo,
                    preview,
                    local,
                    accountId: requestedAccount,
                    folder: folder.id,
                  })}
                  className={`${styles.folder}${active ? ` ${styles.active}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span>{folder.name}</span>
                  {folder.unreadCount ? <small>{folder.unreadCount}</small> : null}
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        <div className={styles.empty}>
          <h2 className={styles.sectionLabel}>MAIL FOLDERS</h2>
          <p>Connect an account to browse your mail.</p>
          <Link href="/mail#connect" className={styles.connectLink}>
            Connect mail
          </Link>
        </div>
      )}
    </div>
  );
}
