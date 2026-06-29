import AssistantPanel from "@/components/assistant/AssistantPanel";
import type { SummaryDocRef } from "@/lib/summaries";

/**
 * Right-rail companion. Notes render inline as article highlights with
 * popovers, so the rail is the AI agent only.
 */
export default function RightRailPanels({ doc }: { doc?: SummaryDocRef }) {
  return <AssistantPanel doc={doc} />;
}
