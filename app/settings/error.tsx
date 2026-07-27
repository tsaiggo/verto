"use client";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "@/components/settings/Settings.module.css";

export default function SettingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Preferences are temporarily unavailable"
        frame="standard"
      />
      <PageFrame size="standard" className={styles.page}>
        <section className={styles.error} aria-labelledby="settings-error-title" role="alert">
          <h2 id="settings-error-title">Verto could not open Settings</h2>
          <p>No preferences were changed. Try again, or return to the Library.</p>
          <div className={styles.errorActions}>
            <button type="button" className="v-btn v-btn--primary" onClick={reset}>
              Try again
            </button>
            <Link href="/library" className="v-btn">
              Open Library
            </Link>
          </div>
        </section>
      </PageFrame>
    </>
  );
}
