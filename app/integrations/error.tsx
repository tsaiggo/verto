"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "@/components/integrations/Sources.module.css";

export default function IntegrationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Source status is temporarily unavailable"
        frame="standard"
      />
      <PageFrame size="standard" className={styles.statePage}>
        <section className={styles.stateMessage} aria-labelledby="sources-error-title" role="alert">
          <CircleAlert aria-hidden />
          <h2 id="sources-error-title">Verto could not load source details</h2>
          <p>
            Your files were not changed. Try loading the status again, or continue reading the
            content Verto already has.
          </p>
          <div className={styles.stateActions}>
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
