"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/studio/Studio.module.css";

export default function StudioError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.routeError}>
      <section className={styles.state} aria-labelledby="studio-route-error-title">
        <span className={styles.stateIcon} aria-hidden>
          <SearchX />
        </span>
        <h1 id="studio-route-error-title">Knowledge Studio could not be opened</h1>
        <p>
          Verto could not build the insight index. Your summaries, notes, and sources are unchanged.
        </p>
        <div className={styles.stateActions}>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/library">Open library</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
