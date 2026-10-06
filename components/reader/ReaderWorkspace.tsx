"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, ListTree, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ReaderAgentHandoff from "@/components/reader/ReaderAgentHandoff";
import DocumentSwitcher from "@/components/documents/DocumentSwitcher";
import type { SourceNavigationDocument } from "@/components/articles/ArticleNavigation";
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
  currentDocument?: Pick<SummaryDocRef, "href" | "title">;
  sourceDocuments?: SourceNavigationDocument[];
  showTabs?: boolean;
  state?: "ready" | "loading";
  documentLabel?: string;
}

function readDocumentId(href?: string) {
  if (!href || !/^\/read\/(?:local|file)\?/.test(href)) return undefined;
  return new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("document") ?? undefined;
}

function structureToggleTitle(available: boolean, open: boolean) {
  if (!available) return "No page structure is available";
  return open ? "Hide navigation · focus reading" : "Show document navigation";
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
  currentDocument,
  sourceDocuments,
  state = "ready",
  documentLabel = "Document content",
}: ReaderWorkspaceProps) {
  const panelId = useId();
  const { open, toggle } = useDocumentNavigation();
  const navigator =
    navigation ?? (toc ? <div className={styles.outlineNavigation}>{toc}</div> : null);
  const structureOpen = !!navigator && open;
  const current = currentDocument ?? doc;
  return (
    <div className={styles.frame} data-reading-frame data-navigation-open={structureOpen}>
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
        <div className={styles.navigationTools} data-document-navigation-tools>
          <button
            type="button"
            className={styles.navigationToggle}
            aria-label="Toggle document navigation"
            aria-controls={navigator ? panelId : undefined}
            aria-expanded={structureOpen}
            disabled={!navigator}
            title={structureToggleTitle(!!navigator, open)}
            data-document-navigation-toggle
            onClick={toggle}
          >
            {structureOpen ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
          </button>
          <div className={styles.documentSwitcher}>
            <DocumentSwitcher
              mode="read"
              currentId={readDocumentId(current?.href)}
              currentHref={current?.href}
              currentTitle={current?.title}
              sourceDocuments={sourceDocuments}
            />
          </div>
        </div>
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
