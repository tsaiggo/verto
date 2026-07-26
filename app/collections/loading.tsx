import styles from "@/components/collections/Collections.module.css";

export default function CollectionsLoading() {
  return (
    <div className={styles.routeState} aria-label="Loading collections" aria-busy="true">
      <div className={styles.loadingHeader}>
        <span className={styles.loadingTitle} />
        <span className={styles.loadingSubtitle} />
      </div>
      <div className={styles.loadingWorkbench}>
        <div className={styles.loadingRows}>
          {Array.from({ length: 5 }, (_, index) => (
            <div className={styles.loadingRow} key={index}>
              <span className={styles.loadingIcon} />
              <span className={styles.loadingCopy}>
                <span />
                <span />
              </span>
            </div>
          ))}
        </div>
        <div className={styles.loadingContext}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
