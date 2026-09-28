"use client";

import { StatusNotice } from "@/components/feedback/StatusNotice";
import styles from "./MailWorkspace.module.css";

interface MailListNoticesProps {
  loading: boolean;
  loadingMore: boolean;
  hasPage: boolean;
  error: string | null;
  moreError: string | null;
  onRetryFolder: () => void;
  onRetryMore: () => void;
}

export default function MailListNotices({
  loading,
  loadingMore,
  hasPage,
  error,
  moreError,
  onRetryFolder,
  onRetryMore,
}: MailListNoticesProps) {
  return (
    <>
      {loading ? (
        <StatusNotice
          tone="pending"
          title={hasPage ? "Refreshing messages" : "Loading messages"}
          description="Fetching the latest messages from your mail account."
          className={styles.listNotice}
        />
      ) : null}
      {error ? (
        <StatusNotice
          tone="warning"
          title={hasPage ? "Couldn’t update messages" : "Couldn’t load messages"}
          description={error}
          action={{ label: "Try again", onClick: onRetryFolder, disabled: loading }}
          className={styles.listNotice}
        />
      ) : null}
      {moreError ? (
        <StatusNotice
          tone="warning"
          title="Couldn’t load more messages"
          description={moreError}
          action={{ label: "Try again", onClick: onRetryMore, disabled: loadingMore }}
          className={styles.listNotice}
        />
      ) : null}
    </>
  );
}
