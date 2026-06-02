import type { Metadata } from "next";
import { getConnectionDetails } from "@/lib/connection-info";
import ConnectSourceView from "@/components/integrations/ConnectSourceView";

export const metadata: Metadata = {
  title: "Connect source",
  description:
    "Connect remote sources and preview MDX content instantly — GitHub, OneDrive, or Google Drive.",
};

/**
 * Server entry for the "Integrations / Connect source" page. Resolves the
 * active source's connection details from the environment at build time and
 * hands them to the client view, which renders the provider cards, connection
 * form, source-preview panel and recent-activity feed.
 */
export default function IntegrationsPage() {
  const connection = getConnectionDetails();
  return <ConnectSourceView connection={connection} />;
}
