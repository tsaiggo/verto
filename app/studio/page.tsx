import { Suspense } from "react";
import { Command, FileText, Link2, NotebookPen } from "lucide-react";
import ProductUtilities from "@/components/layout/ProductUtilities";
import StudioCards, { StudioLoadingState } from "@/components/studio/StudioCards";
import styles from "@/components/studio/Studio.module.css";

export const metadata = { title: "Knowledge Studio" };

export default function StudioPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header} data-page-identity>
        <div className={styles.headerCopy}>
          <div className={styles.titleRow}>
            <Command aria-hidden />
            <h1>Knowledge Studio</h1>
          </div>
          <p>Review reusable insights while keeping every source attached.</p>
          <div className={styles.headerMeta} aria-label="Knowledge Studio capabilities">
            <span>
              <FileText aria-hidden /> Grounded summaries
            </span>
            <span>
              <NotebookPen aria-hidden /> Passage notes
            </span>
            <span>
              <Link2 aria-hidden /> Source-linked
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <ProductUtilities />
        </div>
      </header>

      <Suspense fallback={<StudioLoadingState />}>
        <StudioCards />
      </Suspense>
    </div>
  );
}
