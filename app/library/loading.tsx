import styles from "@/components/library/Library.module.css";

export default function LibraryLoading() {
  return (
    <div className={styles.routeState} aria-busy="true" aria-label="Loading Library">
      <div className={styles.routeLoading}>
        <div className={styles.routeLoadingHeader} aria-hidden>
          <span className={styles.routeLoadingTitle} />
          <span className={styles.routeLoadingSubtitle} />
        </div>
        <div className={styles.loadingRows} aria-hidden>
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className={styles.loadingRow}>
              <span className={styles.skeletonIcon} />
              <span className={styles.skeleton}>
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonShort} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
