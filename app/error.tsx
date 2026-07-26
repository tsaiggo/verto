"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { SystemState, systemStateStyles as styles } from "@/components/layout/SystemState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SystemState
      eyebrow="Workspace error"
      icon={AlertCircle}
      title="This view could not load"
      description="Your local files were not changed. Try the view again; if it keeps failing, return Home and check the active source."
      actions={
        <>
          <button type="button" onClick={reset} className={styles.primary}>
            <RotateCcw aria-hidden />
            Try again
          </button>
          <Link href="/" className={styles.secondary}>
            <ArrowLeft aria-hidden />
            Back to Home
          </Link>
        </>
      }
    />
  );
}
