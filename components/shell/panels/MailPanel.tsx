"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox, Mail, PanelLeft } from "lucide-react";
import { useMailSession } from "@/lib/mail/session";
import styles from "./MailPanel.module.css";

export default function MailPanel({ onCollapse }: { onCollapse?: () => void }) {
  const session = useMailSession();
  const searchParams = useSearchParams();
  const connection = session.connection;
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
            <span className={styles.accountName}>{connection.account.displayName}</span>
            <span className={styles.accountAddress}>{connection.account.address}</span>
          </div>
          <nav className={styles.folders} aria-label="Mail folders">
            <span className={styles.sectionLabel}>Folders</span>
            {connection.folders.map((folder) => {
              const active = folder.id === selectedFolder;
              return (
                <Link
                  key={folder.id}
                  href={`/mail?folder=${encodeURIComponent(folder.id)}`}
                  className={`${styles.folder}${active ? ` ${styles.active}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Inbox aria-hidden="true" />
                  <span>{folder.name}</span>
                  {folder.unreadCount ? <small>{folder.unreadCount}</small> : null}
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        <div className={styles.empty}>
          <p>Connect an account to browse your mail.</p>
          <Link href="/mail#connect" className={styles.connectLink}>
            Connect mail
          </Link>
        </div>
      )}
    </div>
  );
}
