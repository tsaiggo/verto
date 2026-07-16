import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { ContentStatus } from "@/components/ui/content-primitives";

export default function AgentLoading() {
  return (
    <ContentPage width="compact" aria-busy="true">
      <ContentHeader
        title="Agent"
        description="Ask questions and draft from your active workspace sources."
      />
      <ContentStatus
        status="loading"
        title="Preparing Agent"
        description="Reading the source catalog and restoring portable conversations."
      />
    </ContentPage>
  );
}
