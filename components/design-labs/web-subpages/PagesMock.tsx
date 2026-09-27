"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  CornerDownRight,
  Eye,
  FileText,
  FolderTree,
  Link2,
  LoaderCircle,
  Plus,
} from "lucide-react";
import styles from "./PagesMock.module.css";

type SamplePage = "parent" | "child";
type PreviewSaveState = "ready" | "draft" | "saving" | "updated";

interface PageContent {
  title: string;
  body: string;
}

interface PreviewSubpage {
  id: string;
  parent: SamplePage;
  title: string;
}

export interface PagesMockProps {
  selectedPage?: SamplePage;
  onSelectPage?: (page: SamplePage) => void;
  onSubpagesChange?: (items: Array<{ id: string; title: string; parent: SamplePage }>) => void;
  onTitlesChange?: (titles: Record<SamplePage, string>) => void;
}

const INITIAL_PAGES: Record<SamplePage, PageContent> = {
  parent: {
    title: "Research workspace",
    body: "A home for the questions, sources, and notes that keep this project moving.\n\nStart with a source. Keep the original close. Turn the useful parts into pages you can find again.",
  },
  child: {
    title: "Reading synthesis",
    body: "The strongest ideas in this collection connect what I read to what I want to make.\n\nCapture the claim in my own words. Link it to the source. Add a question worth revisiting.",
  },
};

const SAVE_LABEL: Record<PreviewSaveState, string> = {
  ready: "Preview ready",
  draft: "Editing preview",
  saving: "Updating preview…",
  updated: "Preview updated",
};

/** Interactive central canvas for the Web subpages design review. No data leaves React state. */
// eslint-disable-next-line complexity, max-lines-per-function -- the self-contained preview keeps page editing, child rows, and backlinks together
export default function PagesMock({
  selectedPage,
  onSelectPage,
  onSubpagesChange,
  onTitlesChange,
}: PagesMockProps) {
  const [internalPage, setInternalPage] = useState<SamplePage>("child");
  const [pages, setPages] = useState(INITIAL_PAGES);
  const [subpages, setSubpages] = useState<PreviewSubpage[]>([]);
  const [saveState, setSaveState] = useState<PreviewSaveState>("ready");
  const saveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const subpagesRef = useRef<PreviewSubpage[]>([]);
  const newSubpageInput = useRef<HTMLInputElement>(null);
  const activePage = selectedPage ?? internalPage;
  const page = pages[activePage];
  const ownSubpages = subpages.filter((subpage) => subpage.parent === activePage);

  useEffect(() => {
    return () => saveTimers.current.forEach(clearTimeout);
  }, []);

  function markPreviewChange() {
    saveTimers.current.forEach(clearTimeout);
    setSaveState("draft");
    saveTimers.current = [
      setTimeout(() => {
        setSaveState("saving");
        saveTimers.current = [setTimeout(() => setSaveState("updated"), 400)];
      }, 650),
    ];
  }

  function selectPage(nextPage: SamplePage) {
    setInternalPage(nextPage);
    onSelectPage?.(nextPage);
  }

  function updatePage(field: keyof PageContent, value: string) {
    const next = {
      ...pages,
      [activePage]: { ...pages[activePage], [field]: value },
    };
    setPages(next);
    if (field === "title") {
      onTitlesChange?.({ parent: next.parent.title, child: next.child.title });
    }
    markPreviewChange();
  }

  function addSubpage() {
    const current = subpagesRef.current;
    const next = [
      ...current,
      { id: `preview-${current.length + 1}`, parent: activePage, title: "Untitled subpage" },
    ];
    subpagesRef.current = next;
    setSubpages(next);
    onSubpagesChange?.(next);
    markPreviewChange();
    requestAnimationFrame(() => newSubpageInput.current?.focus());
  }

  function renameSubpage(id: string, title: string) {
    const next = subpagesRef.current.map((subpage) =>
      subpage.id === id ? { ...subpage, title } : subpage
    );
    subpagesRef.current = next;
    setSubpages(next);
    onSubpagesChange?.(next);
    markPreviewChange();
  }

  const backlink = activePage === "child" ? pages.parent : pages.child;
  const backlinkPage: SamplePage = activePage === "child" ? "parent" : "child";

  return (
    <section className={styles.root} aria-label="Pages design preview">
      <header className={styles.topbar}>
        <div className={styles.contextLabel}>
          <FolderTree aria-hidden="true" />
          <span>My Pages</span>
          <span className={styles.topbarSeparator}>/</span>
          <span className={styles.contextCurrent}>Page</span>
        </div>
        <div className={styles.statusGroup}>
          <span className={styles.previewBadge}>
            <Eye aria-hidden="true" />
            Preview only
          </span>
          <span className={styles.saveStatus} role="status" aria-live="polite">
            {saveState === "saving" ? (
              <LoaderCircle className={styles.spinning} aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {SAVE_LABEL[saveState]}
          </span>
        </div>
      </header>

      <div className={styles.scrollArea}>
        <article className={styles.canvas}>
          <nav aria-label="Page breadcrumb" className={styles.breadcrumb}>
            <span>My Pages</span>
            <ChevronRight aria-hidden="true" />
            {activePage === "child" ? (
              <>
                <button type="button" onClick={() => selectPage("parent")}>
                  {pages.parent.title || "Untitled"}
                </button>
                <ChevronRight aria-hidden="true" />
              </>
            ) : null}
            <strong aria-current="page">{page.title || "Untitled"}</strong>
          </nav>

          <div className={styles.pageIcon} aria-hidden="true">
            <FileText />
          </div>
          <label className={styles.srOnly} htmlFor="pages-preview-title">
            Page title preview
          </label>
          <input
            id="pages-preview-title"
            className={styles.pageTitle}
            value={page.title}
            onChange={(event) => updatePage("title", event.target.value)}
            placeholder="Untitled"
            spellCheck={false}
          />
          <div className={styles.pageMeta}>
            <span>{activePage === "child" ? "Subpage" : "Root page"}</span>
            <span aria-hidden="true">·</span>
            <span>Changes stay in this preview</span>
          </div>

          <label className={styles.srOnly} htmlFor="pages-preview-body">
            Page body preview
          </label>
          <textarea
            id="pages-preview-body"
            className={styles.pageBody}
            value={page.body}
            onChange={(event) => updatePage("body", event.target.value)}
            placeholder="Start writing…"
            spellCheck={false}
          />
          <div className={styles.inlineLink}>
            <Link2 aria-hidden="true" />
            <span>Linked page</span>
            <button type="button" onClick={() => selectPage(backlinkPage)}>
              {backlink.title || "Untitled"}
            </button>
          </div>
          <p className={styles.blockHint}>
            Type here to try the writing surface. This preview resets on refresh.
          </p>

          <div className={styles.relatedGrid}>
            <section className={styles.subpages} aria-labelledby="pages-preview-subpages">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="pages-preview-subpages">Subpages</h2>
                  <p>Keep related thinking one level below this page.</p>
                </div>
                <button type="button" className={styles.addButton} onClick={addSubpage}>
                  <Plus aria-hidden="true" />
                  Add subpage
                </button>
              </div>

              <div className={styles.childList}>
                {activePage === "parent" ? (
                  <button
                    type="button"
                    className={styles.childCard}
                    onClick={() => selectPage("child")}
                  >
                    <span className={styles.childIcon}>
                      <FileText aria-hidden="true" />
                    </span>
                    <span className={styles.childText}>
                      <strong>{pages.child.title || "Untitled"}</strong>
                      <small>A page for connected ideas and notes</small>
                    </span>
                    <ChevronRight className={styles.childChevron} aria-hidden="true" />
                  </button>
                ) : null}
                {ownSubpages.map((subpage, index) => (
                  <div key={subpage.id} className={styles.childCard}>
                    <span className={styles.childIcon}>
                      <FileText aria-hidden="true" />
                    </span>
                    <span className={styles.childText}>
                      <input
                        ref={index === ownSubpages.length - 1 ? newSubpageInput : undefined}
                        aria-label="Preview subpage title"
                        value={subpage.title}
                        onChange={(event) => renameSubpage(subpage.id, event.target.value)}
                        placeholder="Untitled subpage"
                      />
                      <small>Local preview subpage</small>
                    </span>
                  </div>
                ))}
                {activePage === "child" && ownSubpages.length === 0 ? (
                  <div className={styles.emptySubpages}>
                    <CornerDownRight aria-hidden="true" />
                    <span>No subpages yet. Add one to sketch the next layer.</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.backlinks} aria-labelledby="pages-preview-backlinks">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="pages-preview-backlinks">Linked from</h2>
                  <p>Pages that point back to this one.</p>
                </div>
                <span className={styles.linkCount}>1</span>
              </div>
              <button
                type="button"
                className={styles.backlinkRow}
                onClick={() => selectPage(backlinkPage)}
              >
                <span className={styles.backlinkIcon}>
                  <Link2 aria-hidden="true" />
                </span>
                <span>
                  <strong>{backlink.title || "Untitled"}</strong>
                  <small>{activePage === "child" ? "Parent page" : "Related subpage"}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
