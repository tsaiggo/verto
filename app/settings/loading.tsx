import PageHeader from "@/components/layout/PageHeader";
import styles from "@/components/settings/Settings.module.css";

export default function SettingsLoading() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Loading preferences" />
      <section className={styles.page} aria-busy="true" aria-label="Loading settings">
        <div className={styles.loading}>
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
        </div>
      </section>
    </>
  );
}
