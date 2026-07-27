import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "@/components/integrations/Sources.module.css";

export default function IntegrationsLoading() {
  return (
    <>
      <PageHeader title="Sources" subtitle="Reading local source status" frame="standard" />
      <PageFrame
        as="section"
        size="standard"
        className={styles.page}
        aria-busy="true"
        aria-label="Loading sources"
      >
        <div className={styles.loading}>
          {[0, 1].map((item) => (
            <section className={styles.loadingSection} key={item}>
              <div className={styles.loadingLine} />
              <div className={styles.loadingLine} />
            </section>
          ))}
        </div>
      </PageFrame>
    </>
  );
}
