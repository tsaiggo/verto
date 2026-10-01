import type { ReactNode } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import ReaderAgentHandoff from "@/components/reader/ReaderAgentHandoff";
import type { SummaryDocRef } from "@/lib/summaries";
import { cn } from "@/lib/utils";
import styles from "./ReaderWorkspace.module.css";

interface ReaderWorkspaceProps {
  children: ReactNode;
  masthead?: ReactNode;
  toc?: ReactNode;
  doc?: SummaryDocRef;
  showTabs?: boolean;
  state?: "ready" | "loading";
  documentLabel?: string;
}

/**
 * Canonical Reader frame. The document stays primary while wide screens add a
 * compact outline. Selection actions hand off their document context to Agent.
 */
export default function ReaderWorkspace({
  children,
  masthead,
  toc,
  doc,
  showTabs: _showTabs = true,
  state = "ready",
  documentLabel = "Document content",
}: ReaderWorkspaceProps) {
  return (
    <div className={styles.scroll} data-page-scroll data-reader-state={state}>
      <div className={cn(styles.workbench, !toc && styles.withoutToc)} data-reader-workbench>
        <section
          className={cn("main", styles.document)}
          aria-label={documentLabel}
          data-reader-document
        >
          {masthead}
          {toc ? (
            <details className={styles.compactToc}>
              <summary>
                <span>
                  <ListTree aria-hidden />
                  On this page
                </span>
                <ChevronDown aria-hidden />
              </summary>
              <div className={styles.compactTocBody}>{toc}</div>
            </details>
          ) : null}
          {children}
        </section>

        {toc ? (
          <aside
            className={cn("toc-rail", styles.tocRail)}
            aria-label="Page outline"
            data-context-panel
          >
            <div className={cn("rail-panel", "toc-panel", styles.tocCard)}>{toc}</div>
          </aside>
        ) : null}

        {doc ? <ReaderAgentHandoff doc={doc} /> : null}
      </div>
    </div>
  );
}
