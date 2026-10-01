"use client";

import { useState } from "react";
import styles from "./MailAccountSwitcher.module.css";

export default function MailSavedDataAction({
  id,
  address,
  onClear,
}: {
  id: string;
  address: string;
  onClear: (id: string) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function clear() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      await onClear(id);
      setConfirming(false);
      setMessage("Saved mail cleared. Your drafts and account connection are kept.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Saved mail could not be cleared. Try again."
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.savedDataAction}>
      {confirming ? (
        <div className={styles.confirmation}>
          <p>
            Clear saved mail for {address}? This removes saved messages from this browser. Drafts
            and account connections are kept.
          </p>
          <div className={styles.confirmationActions}>
            <button
              type="button"
              className={styles.quietButton}
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.quietButton}
              disabled={pending}
              onClick={() => void clear()}
            >
              {pending ? "Clearing…" : "Clear saved mail"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.quietButton}
          aria-label={`Clear saved mail for ${address}`}
          onClick={() => setConfirming(true)}
        >
          Clear saved mail
        </button>
      )}
      {message && (
        <p className={styles.accountMessage} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
