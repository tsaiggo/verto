"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2, MoreHorizontal, Pencil, FolderInput, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  articleDisplayTitle,
  browserArticleEditorHref,
  createBrowserArticle,
  saveBrowserArticle,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { requestAppNavigation } from "@/lib/app-navigation";
import { articleDescendantIds } from "./page-hierarchy";
import styles from "./ArticlePageActions.module.css";

interface ArticlePageActionsProps {
  article: BrowserArticle;
  articles: BrowserArticle[];
  disabled: boolean;
  onUpdate: (patch: Partial<Pick<BrowserArticle, "title" | "parentId">>) => Promise<void>;
  onRemove: () => Promise<boolean>;
}

export function ArticlePageActions({
  article,
  articles,
  disabled,
  onUpdate,
  onRemove,
}: ArticlePageActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"actions" | "rename" | "move" | "remove">("actions");
  const [title, setTitle] = useState(articleDisplayTitle(article));
  const [parentId, setParentId] = useState(article.parentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const blocked = disabled || busy;
  const descendants = articleDescendantIds(articles, article.id);
  const parents = articles.filter(
    (candidate) => candidate.status === "saved" && !descendants.has(candidate.id)
  );
  const hasChildren = articles.some((candidate) => candidate.parentId === article.id);

  async function createChild() {
    if (blocked) return;
    setBusy(true);
    setError("");
    try {
      const child = createBrowserArticle({
        filename: "untitled.mdx",
        source: "# Untitled\n\n",
        title: "Untitled subpage",
        parentId: article.id,
        status: "saved",
      });
      const result = await saveBrowserArticle(child, null);
      if (!alive.current) return;
      if (result.status !== "saved") throw new Error("The subpage could not be saved. Try again.");
      if (requestAppNavigation()) router.push(browserArticleEditorHref(result.article.id));
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : "The subpage could not be created.");
        setOpen(true);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || view === "actions") return;
    setBusy(true);
    setError("");
    try {
      if (view === "remove") {
        if (!(await onRemove()) || !alive.current) return;
        // The clean page has been removed and the hook has settled its pending
        // write. Let that state commit before the navigation leave guard runs.
        requestAnimationFrame(() => {
          if (alive.current && requestAppNavigation()) router.push("/library?view=notes");
        });
      } else {
        await onUpdate(
          view === "rename" ? { title: title.trim() } : { parentId: parentId || null }
        );
      }
      if (alive.current) setOpen(false);
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "The page could not be updated.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function select(next: typeof view) {
    setTitle(articleDisplayTitle(article));
    setParentId(article.parentId ?? "");
    setView(next);
    setError("");
  }
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.trigger}
        disabled={blocked}
        onClick={() => void createChild()}
        title={disabled ? "Save your changes before adding a subpage" : undefined}
      >
        <FilePlus2 aria-hidden />
        {busy && !open ? "Creating…" : "New subpage"}
      </button>
      <Popover
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (value) select("actions");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label="Page actions"
            title={disabled ? "Save your changes before organizing this page" : "Page actions"}
            disabled={blocked}
          >
            <MoreHorizontal aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={styles.popover}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {view === "actions" ? (
            <div className={styles.options}>
              <button type="button" onClick={() => select("rename")}>
                <Pencil aria-hidden />
                Rename page
              </button>
              <button type="button" onClick={() => select("move")}>
                <FolderInput aria-hidden />
                Move page
              </button>
              <button
                type="button"
                className={styles.removeAction}
                onClick={() => select("remove")}
              >
                <Trash2 aria-hidden />
                Remove page
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className={styles.form}>
              <button
                type="button"
                className={styles.back}
                aria-label="Back to page actions"
                onClick={() => select("actions")}
                disabled={busy}
              >
                <ArrowLeft aria-hidden />
                Page actions
              </button>
              {view === "rename" ? (
                <>
                  <label htmlFor="page-title">Page title</label>
                  <input
                    id="page-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={240}
                    required
                    disabled={busy}
                    autoFocus
                  />
                  <p>Updates the page name. Markdown source and filename stay unchanged.</p>
                </>
              ) : view === "move" ? (
                <>
                  <label htmlFor="page-parent">Parent page</label>
                  <select
                    id="page-parent"
                    value={parentId}
                    onChange={(event) => setParentId(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Top level</option>
                    {parents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {articleDisplayTitle(parent)}
                      </option>
                    ))}
                  </select>
                  <p>Subpages move with this page. The document source is preserved.</p>
                </>
              ) : (
                <>
                  <strong>Remove “{articleDisplayTitle(article)}”?</strong>
                  <p>
                    {hasChildren
                      ? "Move or remove its subpages first. This page will be kept."
                      : "This removes the saved page from this library. Export it first if you need a copy."}
                  </p>
                </>
              )}
              <div className={styles.footer}>
                <button type="button" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  className={view === "remove" ? styles.destructive : styles.submit}
                  type="submit"
                  disabled={
                    blocked ||
                    (view === "rename" && !title.trim()) ||
                    (view === "remove" && hasChildren)
                  }
                >
                  {busy
                    ? "Saving…"
                    : view === "remove"
                      ? "Remove page"
                      : view === "move"
                        ? "Move page"
                        : "Rename page"}
                </button>
              </div>
            </form>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
