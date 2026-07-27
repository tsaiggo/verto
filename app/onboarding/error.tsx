"use client";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "./Onboarding.module.css";

export default function OnboardingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Set up Verto" subtitle="Setup can be resumed at any time" frame="narrow" />
      <PageFrame size="narrow" className={styles.page}>
        <section
          className={styles.routeError}
          aria-labelledby="onboarding-error-title"
          role="alert"
        >
          <h2 id="onboarding-error-title">Setup could not continue</h2>
          <p>
            No files or preferences were changed. Try this step again, or skip setup and use the
            included demo.
          </p>
          <div className={styles.routeErrorActions}>
            <button type="button" className="v-btn v-btn--primary" onClick={reset}>
              Try again
            </button>
            <Link href="/library" className="v-btn">
              Skip setup
            </Link>
          </div>
        </section>
      </PageFrame>
    </>
  );
}
