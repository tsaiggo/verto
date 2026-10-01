import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StudioCards, { StudioLoadingState } from "@/components/studio/StudioCards";
import styles from "@/components/studio/Studio.module.css";

export const metadata = { title: "Knowledge Studio" };

export default function StudioPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge Studio"
        subtitle="Review saved summaries and notes with their sources attached."
        frame="wide"
        flush
      />

      <Suspense fallback={<StudioLoadingState />}>
        <StudioCards />
      </Suspense>
    </div>
  );
}
