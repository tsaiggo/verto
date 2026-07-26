import PageHeader from "@/components/layout/PageHeader";
import styles from "./Onboarding.module.css";

export default function OnboardingLoading() {
  return (
    <>
      <PageHeader title="Set up Verto" subtitle="Local files first. AI is optional." />
      <section className={styles.page} aria-busy="true" aria-label="Loading setup">
        <div className={styles.routeLoading}>
          <div className={styles.routeLoadingLine} />
          <div className={styles.routeLoadingLine} />
        </div>
      </section>
    </>
  );
}
