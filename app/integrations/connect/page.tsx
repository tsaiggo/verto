import type { Metadata } from "next";
import ConnectSourceView from "@/components/integrations/ConnectSourceView";
import { getConnectionDetails } from "@/lib/connection-info";

export const metadata: Metadata = {
  title: "Connect a source",
  description: "Connect a content source to your Verto library.",
};

// Real "Add source" destination: renders the interactive ConnectSourceView
// seeded from the active build-time connection (VERTO_CONTENT_SOURCE).
export default function ConnectSourcePage() {
  const connection = getConnectionDetails();
  return <ConnectSourceView connection={connection} />;
}
