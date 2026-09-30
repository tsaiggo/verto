"use client";

import { Button } from "@/components/ui/button";
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
      {loading && (
        <p className={styles.listNotice} role="status">
          {hasPage ? "Refreshing messages…" : "Loading messages…"}
        </p>
      )}
      {error && (
        <div className={styles.listNotice} role="alert">
          <strong>{hasPage ? "Couldn’t update messages" : "Couldn’t load messages"}</strong>
          <p>{error}</p>
          <Button variant="outline" size="sm" disabled={loading} onClick={onRetryFolder}>
            Try again
          </Button>
        </div>
      )}
      {moreError && (
        <div className={styles.listNotice} role="alert">
          <strong>Couldn’t load more messages</strong>
          <p>{moreError}</p>
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={onRetryMore}>
            Try again
          </Button>
        </div>
      )}
    </>
  );
}
