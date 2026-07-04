import type { Metadata } from "next";
import { getConnectionDetails } from "@/lib/connection-info";
import SourcesWorkflowView from "@/components/integrations/SourcesWorkflowView";

export const metadata: Metadata = {
  title: "Sources & Git Workflow",
  description:
    "Manage sources, integrations, sync status, Git changes, and conflict resolution.",
};

/**
 * Server entry for the "Integrations / Connect source" page. Resolves the
 * active source's connection details from the environment at build time and
 * hands them to the client view, which renders the provider cards, connection
 * form, source-preview panel and recent-activity feed.
 */
export default function IntegrationsPage() {
  const connection = getConnectionDetails();
  return <SourcesWorkflowView connection={connection} />;
}
