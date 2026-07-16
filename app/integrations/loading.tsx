import { FolderOpen, PlugZap, Rss } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { ContentPanel, ContentSection, ContentStatus } from "@/components/ui/content-primitives";
import styles from "@/components/integrations/Sources.module.css";

export default function IntegrationsLoading() {
  return (
    <ContentPage width="standard" aria-busy="true">
      <ContentHeader
        title="Sources & Integrations"
        description="Manage the local Library and RSS feeds Verto can read today."
        icon={<PlugZap />}
      />
      <div className={styles.workbench}>
        <ContentSection
          title={
            <span className={styles.sectionTitle}>
              <span className={styles.sourceIcon} aria-hidden>
                <FolderOpen />
              </span>
              Local Library
            </span>
          }
          description="Loading the active folder and its readable files."
        >
          <ContentPanel variant="outlined" className={styles.loadingPanel}>
            <ContentStatus
              status="loading"
              title="Checking the local Library"
              description="Verto is reading the current connection state."
            />
          </ContentPanel>
        </ContentSection>
        <ContentSection
          title={
            <span className={styles.sectionTitle}>
              <span className={styles.sourceIcon} aria-hidden>
                <Rss />
              </span>
              RSS
            </span>
          }
          description="Loading feed subscriptions and sync status."
        >
          <ContentPanel variant="outlined" className={styles.loadingPanel}>
            <ContentStatus
              status="loading"
              title="Checking RSS subscriptions"
              description="Verto is reading subscriptions saved on this device."
            />
          </ContentPanel>
        </ContentSection>
      </div>
    </ContentPage>
  );
}
