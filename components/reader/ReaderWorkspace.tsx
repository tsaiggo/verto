"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, ListTree, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ReaderAgentHandoff from "@/components/reader/ReaderAgentHandoff";
import type { SummaryDocRef } from "@/lib/summaries";
import { cn } from "@/lib/utils";
import readingStyles from "./ReadingArticle.module.css";
import styles from "./ReaderWorkspace.module.css";
import { useDocumentNavigation } from "./useDocumentNavigation";

interface ReaderWorkspaceProps {
  children: ReactNode;
  masthead?: ReactNode;
  toc?: ReactNode;
  navigation?: ReactNode;
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
  navigation,
  doc,
  state = "ready",
  documentLabel = "Document content",
}: ReaderWorkspaceProps) {
  const panelId = useId();
  const { open, toggle } = useDocumentNavigation();
  const navigator =
    navigation ?? (doc && toc ? <div className={styles.outlineNavigation}>{toc}</div> : null);
  return (
    <div className={styles.frame} data-reading-frame data-navigation-open={!!navigator && open}>
      {navigator ? (
        <aside
          id={panelId}
          className={styles.navigator}
          aria-label="Document navigation"
          hidden={!open}
        >
          {navigator}
        </aside>
      ) : null}
      <div className={styles.readingPane}>
        {navigator ? (
          <div className={styles.navigationTools} data-document-navigation-tools>
            <button
              type="button"
              className={styles.navigationToggle}
              aria-label="Toggle document navigation"
              aria-controls={panelId}
              aria-expanded={open}
              title={open ? "Hide navigation · focus reading" : "Show document navigation"}
              data-document-navigation-toggle
              onClick={toggle}
            >
              {open ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
            </button>
          </div>
        ) : null}
        <div className={styles.scroll} data-page-scroll data-reader-state={state}>
          <div className={styles.workbench} data-reader-workbench>
            <section
              className={cn("main", styles.document, readingStyles.surface)}
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

            {doc ? <ReaderAgentHandoff doc={doc} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
