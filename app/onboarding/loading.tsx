import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "./Onboarding.module.css";

export default function OnboardingLoading() {
  return (
    <>
      <PageHeader
        title="Set up Verto"
        subtitle="Local files first. AI is optional."
        frame="narrow"
      />
      <PageFrame
        as="section"
        size="narrow"
        className={styles.page}
        aria-busy="true"
        aria-label="Loading setup"
      >
        <div className={styles.routeLoading}>
          <div className={styles.routeLoadingLine} />
          <div className={styles.routeLoadingLine} />
        </div>
      </PageFrame>
    </>
  );
}
