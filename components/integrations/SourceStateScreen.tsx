import Link from "next/link";
import { AlertTriangle, FileSearch, FolderLock, FolderOpen } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "./Sources.module.css";

export type SourceSystemState = "no-source" | "syncing" | "sync-failed" | "permission-denied";

const STATE_COPY: Record<
  SourceSystemState,
  {
    title: string;
    description: string;
    icon: typeof FolderOpen;
    action: string;
    href: string;
    secondary?: { label: string; href: string };
  }
> = {
  "no-source": {
    title: "Choose a folder to start your library",
    description:
      "Verto reads Markdown and MDX in place. Your files remain in the folder you choose and can keep syncing through OneDrive, Dropbox, or another system folder.",
    icon: FolderOpen,
    action: "Choose a source",
    href: "/integrations#local-files",
    secondary: { label: "Open included demo", href: "/library" },
  },
  syncing: {
    title: "Indexing the local folder",
    description:
      "Verto is reading file names and headings so Library and Search can use them. Files stay in place and remain editable while indexing runs.",
    icon: FileSearch,
    action: "View source status",
    href: "/integrations#local-files",
  },
  "sync-failed": {
    title: "Indexing did not finish",
    description:
      "The folder may be unavailable or contain a file Verto could not read. Nothing was changed. Reopen the source to inspect it and try again.",
    icon: AlertTriangle,
    action: "Review source",
    href: "/integrations#local-files",
    secondary: { label: "Open Library", href: "/library" },
  },
  "permission-denied": {
    title: "Folder access needs to be restored",
    description:
      "The operating system no longer allows Verto to read this folder. Your files are safe. Choose the folder again to grant access and resume indexing.",
    icon: FolderLock,
    action: "Reconnect folder",
    href: "/integrations#local-files",
    secondary: { label: "Open included content", href: "/library" },
  },
};

export default function SourceStateScreen({ state }: { state: SourceSystemState }) {
  const copy = STATE_COPY[state];
  const Icon = copy.icon;

  return (
    <>
      <PageHeader
        title="Sources"
        subtitle={state === "syncing" ? "Local index status" : "Source recovery"}
        frame="standard"
      />
      <PageFrame size="standard" className={styles.statePage}>
        <section className={styles.stateMessage} aria-labelledby="source-state-title">
          <Icon aria-hidden />
          <h2 id="source-state-title">{copy.title}</h2>
          <p>{copy.description}</p>
          <div className={styles.stateActions}>
            <Link href={copy.href} className="v-btn v-btn--primary">
              {copy.action}
            </Link>
            {copy.secondary ? (
              <Link href={copy.secondary.href} className="v-btn">
                {copy.secondary.label}
              </Link>
            ) : null}
          </div>
        </section>
      </PageFrame>
    </>
  );
}
