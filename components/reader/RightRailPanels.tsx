import { HelpCircle } from "lucide-react";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import NotesPanel from "@/components/reader/NotesPanel";
import SummaryCard from "@/components/summary/SummaryCard";
import type { SummaryDocRef } from "@/lib/summaries";

/**
 * Right-rail informational panels shown beneath the table of contents.
 */
export default function RightRailPanels({ doc }: { doc?: SummaryDocRef }) {
  return (
    <>
      <AssistantPanel />

      {doc && <SummaryCard doc={doc} />}

      {doc && <NotesPanel docSlug={doc.slug.join("/")} />}

      <section className="rail-panel help-panel" aria-label="Help">
        <div className="help-panel-head">
          <HelpCircle className="help-panel-icon" aria-hidden />
          <span className="help-panel-title">Need help?</span>
        </div>
        <p className="help-panel-text">Check out our guides or reach out to the community.</p>
        <a
          href="https://github.com/tsaiggo/verto"
          target="_blank"
          rel="noopener noreferrer"
          className="help-panel-link"
        >
          Visit MDX Support
          <span aria-hidden> ↗</span>
        </a>
      </section>
    </>
  );
}
