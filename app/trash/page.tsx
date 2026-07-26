import Link from "next/link";
import { ArchiveX, BookOpen, FolderOpen } from "lucide-react";
import { SystemState, systemStateStyles as styles } from "@/components/layout/SystemState";

export const metadata = {
  title: "Trash",
  description: "Verto leaves file deletion and recovery to your local file system.",
};

export default function TrashPage() {
  return (
    <SystemState
      eyebrow="Local file ownership"
      icon={ArchiveX}
      title="Trash stays with your file system"
      description="Verto never moves documents into a private recycle bin. Delete or restore the original Markdown file with Explorer, Finder, OneDrive, or your sync provider."
      actions={
        <>
          <Link href="/integrations" className={styles.primary}>
            <FolderOpen aria-hidden />
            View Sources
          </Link>
          <Link href="/library" className={styles.secondary}>
            <BookOpen aria-hidden />
            Back to Library
          </Link>
        </>
      }
    />
  );
}
