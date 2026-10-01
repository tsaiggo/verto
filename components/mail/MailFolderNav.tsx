import Link from "next/link";
import type { MailFolder } from "@/lib/mail/model";
import { mailHref, type MailPreview } from "@/lib/mail/view-state";
import styles from "./MailWorkspace.module.css";

export default function MailFolderNav({
  folders,
  folderId,
  demo = false,
  preview,
  accountId,
}: {
  folders: MailFolder[];
  folderId: string | undefined;
  demo?: boolean;
  preview?: MailPreview;
  accountId?: string;
}) {
  return (
    <nav className={styles.folderNav} aria-label="Mail folders">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={mailHref({ demo, preview, accountId, folder: folder.id })}
          className={`${styles.folderLink}${folder.id === folderId ? ` ${styles.currentFolder}` : ""}`}
          aria-current={folder.id === folderId ? "page" : undefined}
        >
          {folder.name}
          {typeof folder.unreadCount === "number" && folder.unreadCount > 0 && (
            <span>{folder.unreadCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
