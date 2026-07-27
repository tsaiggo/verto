import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "@/components/settings/Settings.module.css";

export default function SettingsLoading() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Loading preferences" frame="standard" />
      <PageFrame
        as="section"
        size="standard"
        className={styles.page}
        aria-busy="true"
        aria-label="Loading settings"
      >
        <div className={styles.loading}>
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
        </div>
      </PageFrame>
    </>
  );
}
