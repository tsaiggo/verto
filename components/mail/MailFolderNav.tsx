import Link from "next/link";
import type { MailFolder } from "@/lib/mail/model";
import styles from "./MailWorkspace.module.css";

export default function MailFolderNav({
  folders,
  folderId,
  demo = false,
}: {
  folders: MailFolder[];
  folderId: string | undefined;
  demo?: boolean;
}) {
  return (
    <nav className={styles.folderNav} aria-label="Mail folders">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={`/mail?${demo ? "demo=1&" : ""}folder=${encodeURIComponent(folder.id)}`}
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
