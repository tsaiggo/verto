"use client";

import { useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Inbox,
  Mail,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Send,
  X,
} from "lucide-react";
import WorkspaceShell from "@/components/shell/WorkspaceShell";
import MailMock from "./MailMock";
import ReaderMock, { PDF_PAGE_COUNT } from "./ReaderMock";
import PagesMock from "./PagesMock";
import styles from "./WebSubpagesPreview.module.css";

type Surface = "mail" | "reader" | "pages";
type ReaderFormat = "epub" | "pdf";
type PageSelection = "parent" | "child";

const SURFACES: { id: Surface; label: string }[] = [
  { id: "mail", label: "Mail" },
  { id: "reader", label: "EPUB / PDF" },
  { id: "pages", label: "Subpages" },
];

function ContextRow({
  icon: Icon,
  children,
  active = false,
  count,
  indent = false,
  deep = false,
  onClick,
}: {
  icon?: typeof Mail;
  children: React.ReactNode;
  active?: boolean;
  count?: string;
  indent?: boolean;
  deep?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      {Icon && <Icon aria-hidden="true" />}
      <span>{children}</span>
      {count && <small>{count}</small>}
    </>
  );
  const className = `${styles.contextRow}${active ? ` ${styles.contextRowActive}` : ""}${indent ? ` ${styles.contextRowIndent}` : ""}${deep ? ` ${styles.contextRowDeep}` : ""}`;

  return onClick ? (
    <button
      type="button"
      className={`${className} ${styles.contextRowButton}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function PreviewContext({
  surface,
  readerFormat,
  chapter,
  pdfPage,
  pageSelection,
  onSelectFormat,
  onSelectChapter,
  onSelectPdfPage,
  onSelectPage,
  pageTitles,
  subpages,
}: {
  surface: Surface;
  readerFormat: ReaderFormat;
  chapter: number;
  pdfPage: number;
  pageSelection: PageSelection;
  onSelectFormat: (format: ReaderFormat) => void;
  onSelectChapter: (chapter: number) => void;
  onSelectPdfPage: (page: number) => void;
  onSelectPage: (page: PageSelection) => void;
  pageTitles: Record<PageSelection, string>;
  subpages: Array<{ id: string; title: string; parent: PageSelection }>;
}) {
  if (surface === "mail") {
    return (
      <div className={styles.context}>
        <div className={styles.contextSectionHeading}>MAIL FOLDERS</div>
        <div className={styles.account}>
          <span className={styles.accountMark}>
            <Mail aria-hidden="true" />
          </span>
          <span>
            <strong>Maya Lee</strong>
            <small>maya.lee@example.com</small>
          </span>
          <ChevronDown aria-hidden="true" />
        </div>
        <ContextRow icon={Inbox} count="2" active>
          Inbox
        </ContextRow>
        <ContextRow icon={Send}>Sent</ContextRow>
        <ContextRow icon={FileText}>Drafts</ContextRow>
        <ContextRow icon={Folder}>Archive</ContextRow>
        <ContextRow icon={Folder}>Trash</ContextRow>
        <div className={styles.contextHint}>Mock mailbox · no account is connected</div>
      </div>
    );
  }

  if (surface === "reader") {
    return (
      <div className={styles.context}>
        <div className={styles.contextSectionHeading}>LIBRARY</div>
        <ContextRow
          icon={BookOpen}
          active={readerFormat === "epub"}
          onClick={() => onSelectFormat("epub")}
        >
          Books
        </ContextRow>
        <ContextRow
          icon={FileText}
          active={readerFormat === "pdf"}
          onClick={() => onSelectFormat("pdf")}
        >
          PDFs
        </ContextRow>
        <div className={styles.contextSectionHeading}>CONTENTS</div>
        {readerFormat === "epub" ? (
          <>
            {["The work of reading", "Making room to think", "What stays with us"].map(
              (title, index) => (
                <ContextRow
                  key={title}
                  active={chapter === index}
                  onClick={() => onSelectChapter(index)}
                >
                  {index + 1}. {title}
                </ContextRow>
              )
            )}
          </>
        ) : (
          <>
            {Array.from(
              { length: 4 },
              (_, index) => Math.min(Math.max(1, pdfPage - 1), PDF_PAGE_COUNT - 3) + index
            ).map((page) => (
              <ContextRow
                key={page}
                active={pdfPage === page}
                onClick={() => onSelectPdfPage(page)}
              >
                Page {page}
              </ContextRow>
            ))}
          </>
        )}
        <div className={styles.contextHint}>Outline changes with the open source</div>
      </div>
    );
  }

  return (
    <div className={styles.context}>
      <div className={styles.contextSectionHeading}>
        <span>MY PAGES</span>
        <Plus aria-hidden="true" />
      </div>
      <ContextRow
        icon={ChevronDown}
        active={pageSelection === "parent"}
        onClick={() => onSelectPage("parent")}
      >
        {pageTitles.parent || "Untitled"}
      </ContextRow>
      {subpages
        .filter((subpage) => subpage.parent === "parent")
        .map((subpage) => (
          <ContextRow key={subpage.id} icon={FileText} indent>
            {subpage.title || "Untitled subpage"}
          </ContextRow>
        ))}
      <ContextRow
        icon={FileText}
        active={pageSelection === "child"}
        indent
        onClick={() => onSelectPage("child")}
      >
        {pageTitles.child || "Untitled"}
      </ContextRow>
      {subpages
        .filter((subpage) => subpage.parent === "child")
        .map((subpage) => (
          <ContextRow key={subpage.id} icon={FileText} indent deep>
            {subpage.title || "Untitled subpage"}
          </ContextRow>
        ))}
      <div className={styles.contextSectionHeading}>CONNECTED SOURCES</div>
      <ContextRow icon={ChevronRight}>Documentation</ContextRow>
      <div className={styles.contextHint}>My Pages are local to this browser in the v1 draft</div>
    </div>
  );
}

function AgentPreview({
  attached,
  currentSource,
  onAttach,
  onClear,
  onCollapse,
}: {
  attached: string | null;
  currentSource: string;
  onAttach: () => void;
  onClear: () => void;
  onCollapse: () => void;
}) {
  return (
    <aside className={styles.agent} aria-label="Agent design preview">
      <header className={styles.agentHeader}>
        <span className={styles.agentTitle}>
          <Bot aria-hidden="true" /> Agent
        </span>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onCollapse}
          aria-label="Collapse Agent"
        >
          <PanelRightClose aria-hidden="true" />
        </button>
      </header>
      <div className={styles.agentBody}>
        <div className={styles.agentEyebrow}>SOURCE CONTEXT</div>
        {attached ? (
          <div className={styles.attachedSource}>
            <Paperclip aria-hidden="true" />
            <span>{attached}</span>
            <button type="button" onClick={onClear} aria-label="Remove attached source">
              <X aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className={styles.noSource}>
            No source attached. Opening a page does not add its content to Agent.
          </p>
        )}
        <button type="button" className={styles.attachButton} onClick={onAttach}>
          <Plus aria-hidden="true" /> Attach {currentSource}
        </button>
        <div className={styles.agentNote}>
          <Bot aria-hidden="true" />
          <p>
            This conversation stays here as you move between Mail, the reader, and pages. Only
            sources you attach are in scope.
          </p>
        </div>
      </div>
      <div className={styles.composer}>
        <span>Ask about attached sources…</span>
        <button type="button" disabled aria-label="Sending is disabled in this design preview">
          <Send aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export default function WebSubpagesPreview() {
  const [surface, setSurface] = useState<Surface>("mail");
  const [reviewWidth, setReviewWidth] = useState<"fluid" | "1280" | "1440">("fluid");
  const [readerFormat, setReaderFormat] = useState<ReaderFormat>("epub");
  const [chapter, setChapter] = useState(1);
  const [pdfPage, setPdfPage] = useState(12);
  const [pageSelection, setPageSelection] = useState<PageSelection>("child");
  const [pageTitles, setPageTitles] = useState<Record<PageSelection, string>>({
    parent: "Research workspace",
    child: "Reading synthesis",
  });
  const [subpages, setSubpages] = useState<
    Array<{ id: string; title: string; parent: PageSelection }>
  >([]);
  const [agentOpen, setAgentOpen] = useState(true);
  const [attached, setAttached] = useState<string | null>(null);
  const currentSource =
    surface === "mail"
      ? "selected mail"
      : surface === "reader"
        ? readerFormat === "epub"
          ? `EPUB chapter ${chapter + 1}`
          : `PDF page ${pdfPage}`
        : "current page";

  return (
    <div className={styles.preview} data-surface={surface} data-review-width={reviewWidth}>
      <WorkspaceShell
        panel={
          <PreviewContext
            surface={surface}
            readerFormat={readerFormat}
            chapter={chapter}
            pdfPage={pdfPage}
            pageSelection={pageSelection}
            onSelectFormat={setReaderFormat}
            onSelectChapter={setChapter}
            onSelectPdfPage={setPdfPage}
            onSelectPage={setPageSelection}
            pageTitles={pageTitles}
            subpages={subpages}
          />
        }
      />
      <div className={styles.work}>
        <header className={styles.previewBar}>
          <span className={styles.previewLabel}>DESIGN PREVIEW</span>
          <nav aria-label="Preview surfaces" className={styles.surfaceTabs}>
            {SURFACES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={surface === item.id ? styles.surfaceTabActive : styles.surfaceTab}
                onClick={() => setSurface(item.id)}
                aria-current={surface === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <select
            className={styles.widthSelect}
            aria-label="Preview width"
            value={reviewWidth}
            onChange={(event) => setReviewWidth(event.target.value as typeof reviewWidth)}
          >
            <option value="fluid">Fluid width</option>
            <option value="1280">1280px</option>
            <option value="1440">1440px</option>
          </select>
          <button
            type="button"
            className={styles.agentToggle}
            onClick={() => setAgentOpen((open) => !open)}
          >
            {agentOpen ? (
              <PanelRightClose aria-hidden="true" />
            ) : (
              <PanelRightOpen aria-hidden="true" />
            )}
            <span>{agentOpen ? "Hide Agent" : "Show Agent"}</span>
          </button>
        </header>
        <main className={styles.canvas} aria-label={`${surface} design preview`}>
          <div className={surface === "mail" ? styles.surfacePane : styles.surfacePaneHidden}>
            <MailMock />
          </div>
          <div className={surface === "reader" ? styles.surfacePane : styles.surfacePaneHidden}>
            <ReaderMock
              format={readerFormat}
              onFormatChange={setReaderFormat}
              chapter={chapter}
              page={pdfPage}
              onChapterChange={setChapter}
              onPageChange={setPdfPage}
            />
          </div>
          <div className={surface === "pages" ? styles.surfacePane : styles.surfacePaneHidden}>
            <PagesMock
              selectedPage={pageSelection}
              onSelectPage={setPageSelection}
              onSubpagesChange={setSubpages}
              onTitlesChange={setPageTitles}
            />
          </div>
        </main>
      </div>
      {agentOpen && (
        <AgentPreview
          attached={attached}
          currentSource={currentSource}
          onAttach={() => setAttached(currentSource)}
          onClear={() => setAttached(null)}
          onCollapse={() => setAgentOpen(false)}
        />
      )}
    </div>
  );
}
