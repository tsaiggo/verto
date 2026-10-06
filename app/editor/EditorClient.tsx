"use client";

import { Component, useRef, useState, type ReactNode } from "react";
import { FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { EditorAgentReview } from "@/components/editor/EditorAgentReview";
import {
  ArticleEditorToolbar,
  type ArticleEditorTab,
} from "@/components/editor/ArticleEditorToolbar";
import { useArticleEditorDocument } from "@/components/editor/ArticleEditorDocument";
import { ArticleSourcePane } from "@/components/editor/ArticleSourcePane";
import workspaceStyles from "@/components/editor/EditorWorkspace.module.css";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import {
  articleFormat,
  articleTitle,
  browserArticleEditorHref,
  browserArticleHref,
} from "@/lib/browser-articles";
import { useEditorLeaveGuard } from "./editor-leave-guard";
import styles from "./EditorPage.module.css";
import { ArticlePageActions } from "@/components/articles/ArticlePageActions";
import { PageBreadcrumbs } from "@/components/articles/PageBreadcrumbs";
import { useBrowserArticles } from "@/components/articles/useBrowserArticles";
import { ManagedBookRuntime } from "@/components/books/MdxBookRuntime";
import { MdxBookActions } from "@/components/books/MdxBookActions";
import ArticleNavigation from "@/components/articles/ArticleNavigation";
import { useDocumentNavigation } from "@/components/reader/useDocumentNavigation";
import readingStyles from "@/components/reader/ReadingArticle.module.css";
import { browserArticleReadingBody } from "@/components/articles/browser-library-docs";
import DocumentSwitcher from "@/components/documents/DocumentSwitcher";

export interface EditorClientProps {
  slug?: string;
}

function exportArticle(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

class EditorPreviewBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="ed-preview-error" role="alert">
          <strong>Preview unavailable</strong>
          <p>Fix the MDX syntax in Source, then open Preview again.</p>
        </div>
      );
    return this.props.children;
  }
}

export default function EditorClient({ slug }: EditorClientProps) {
  const document = useArticleEditorDocument(slug);
  const pages = useBrowserArticles({ enabled: document.managed });
  const [tab, setTab] = useState<ArticleEditorTab>("source");
  const { open: navigationOpen, toggle: toggleNavigation } = useDocumentNavigation();
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [selectionContext, setSelectionContext] = useState<{
    text: string;
    requestId: number;
    sessionId: number;
    filename: string;
  } | null>(null);
  const selectionRequestRef = useRef(0);
  const [exportError, setExportError] = useState("");
  useEditorLeaveGuard(document.blockLeave);

  function handleExport() {
    try {
      exportArticle(document.filename, document.source);
      setExportError("");
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "The article could not be exported. Try again."
      );
    }
  }

  const format = articleFormat(document.filename);
  const title = document.article?.title ?? articleTitle(document.source, document.filename);
  const previewSource = browserArticleReadingBody({
    source: document.source,
    filename: document.filename,
  });
  const documentHeading = (
    <header className={workspaceStyles.documentHeading} data-editor-document-heading>
      <div className={workspaceStyles.titleRow}>
        <FileText aria-hidden />
        <h1>{title}</h1>
      </div>
      <span className={workspaceStyles.format}>{format.toUpperCase()}</span>
    </header>
  );
  return (
    <div
      className={`ed-client ${workspaceStyles.frame}`}
      data-editor-frame
      data-navigation-open={navigationOpen}
      data-document-view={tab}
    >
      <aside
        className={workspaceStyles.navigation}
        id="editor-document-navigation"
        aria-label="Document navigation"
        hidden={!navigationOpen}
      >
        <ArticleNavigation articleId={document.article?.id} mode="edit" />
      </aside>
      <div className={workspaceStyles.editorSurface}>
        <ArticleEditorToolbar
          documentSwitcher={
            <DocumentSwitcher
              mode="edit"
              compact
              currentId={document.loadState.kind === "ready" ? document.article?.id : undefined}
              currentHref={
                document.loadState.kind === "ready" && document.article
                  ? browserArticleEditorHref(document.article.id)
                  : undefined
              }
              currentTitle={title}
            />
          }
          navigationToggle={
            <button
              className={workspaceStyles.navigationToggle}
              type="button"
              aria-label="Toggle document navigation"
              aria-expanded={navigationOpen}
              aria-controls="editor-document-navigation"
              title={navigationOpen ? "Hide document navigation" : "Show document navigation"}
              data-document-navigation-toggle
              onClick={toggleNavigation}
            >
              {navigationOpen ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
            </button>
          }
          tab={tab}
          onTabChange={setTab}
          aiReviewOpen={aiReviewOpen}
          onToggleAiReview={() => setAiReviewOpen((open) => !open)}
          filename={document.filename}
          onFilenameChange={document.changeFilename}
          filenameEditable={!document.desktop || document.fileId === null}
          filenameDisabled={document.readOnly}
          desktop={document.desktop}
          isCopy={Boolean(document.article?.originSlug)}
          hasSource={Boolean(document.originSlug)}
          dirty={document.dirty}
          saveStatus={document.saveStatus}
          canSave={document.canSave}
          readHref={document.article ? browserArticleHref(document.article.id) : undefined}
          onSave={() => void document.save()}
          onExport={handleExport}
          storageScope={document.desktop && document.managed ? "On this device" : undefined}
          savedLabel={document.desktop && document.managed ? "Saved on this device" : undefined}
          breadcrumbs={
            document.article?.status === "saved" ? (
              <PageBreadcrumbs article={document.article} articles={pages.articles} mode="edit" />
            ) : undefined
          }
          pageControls={
            document.article?.status === "saved" ? (
              <>
                <ArticlePageActions
                  key={document.article.id}
                  article={document.article}
                  articles={pages.articles}
                  disabled={document.dirty || !document.canSave || pages.status !== "ready"}
                  onUpdate={document.updateMetadata}
                  onRemove={document.removePage}
                />
                <MdxBookActions
                  key={`book:${document.article.id}`}
                  articleId={document.article.id}
                  parentId={document.article.parentId}
                  source={document.source}
                  disabled={document.dirty || !document.canSave}
                />
              </>
            ) : undefined
          }
        />

        {document.loadState.kind === "loading" && <p className="ed-client-status">Loading…</p>}
        {document.loadState.kind === "error" && (
          <div className={styles.notice}>
            <p role="alert">{document.loadState.message}</p>
            {document.managed && (
              <button type="button" onClick={document.retryLoad}>
                Retry
              </button>
            )}
          </div>
        )}
        {document.saveError && (
          <div className={styles.notice}>
            <p role="alert">{document.saveError}</p>
            {document.saveStatus === "conflict" ? (
              <button type="button" onClick={() => void document.loadSavedVersion()}>
                Load saved version
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void document.save()}
                disabled={!document.canSave}
              >
                Retry save
              </button>
            )}
          </div>
        )}
        {exportError && (
          <div className={styles.notice}>
            <p role="alert">{exportError}</p>
          </div>
        )}

        <div className={workspaceStyles.workspace} data-editor-workspace>
          <div className={workspaceStyles.documentPane} id="editor-document-panel">
            {tab === "source" ? documentHeading : null}
            <div className="ed-client-pane">
              {tab === "preview" ? (
                <div
                  className={`ed-preview-pane ${workspaceStyles.previewSurface} ${readingStyles.surface}`}
                >
                  {documentHeading}
                  <EditorPreviewBoundary>
                    <article className={`prose ${styles.previewArticle}`} data-editor-preview>
                      <ManagedBookRuntime
                        key={document.article?.id ?? "new"}
                        articleId={document.article?.id}
                        parentId={document.article?.parentId}
                        source={document.source}
                      >
                        <RuntimeDocument source={previewSource} format={format} />
                      </ManagedBookRuntime>
                    </article>
                  </EditorPreviewBoundary>
                </div>
              ) : (
                <ArticleSourcePane
                  source={document.source}
                  format={format}
                  onSourceChange={document.changeSource}
                  readOnly={document.readOnly}
                  onAskAi={(text) => {
                    selectionRequestRef.current += 1;
                    setSelectionContext({
                      text,
                      requestId: selectionRequestRef.current,
                      sessionId: document.sessionId,
                      filename: document.filename,
                    });
                    setAiReviewOpen(true);
                  }}
                />
              )}
            </div>
            <div className={workspaceStyles.aiReview} id="editor-ai-review" hidden={!aiReviewOpen}>
              <EditorAgentReview
                key={document.sessionId}
                source={document.source}
                format={format}
                filename={document.filename}
                revision={document.revision}
                onApply={document.changeSource}
                disabled={document.readOnly}
                persistenceMode={
                  document.managed ? (document.desktop ? "managed" : "browser") : "disk"
                }
                selectionContext={
                  selectionContext?.sessionId === document.sessionId &&
                  selectionContext.filename === document.filename
                    ? selectionContext
                    : null
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
