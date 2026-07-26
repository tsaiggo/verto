import { StudioLoadingState } from "@/components/studio/StudioCards";
import styles from "@/components/studio/Studio.module.css";

export default function StudioLoading() {
  return (
    <div className={styles.routeState}>
      <div className={styles.routeLoadingHeader} aria-hidden>
        <span className={styles.routeLoadingTitle} />
        <span className={styles.routeLoadingSubtitle} />
      </div>
      <StudioLoadingState />
    </div>
  );
}
