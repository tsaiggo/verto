"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  annotationNote,
  deleteAnnotation,
  setAnnotationNote,
  type Annotation,
} from "@/lib/annotations";
import { deleteSummary, saveSummary, type SavedSummary } from "@/lib/summaries";
import type { StudioCard } from "@/lib/studio-cards";
import styles from "./StudioCards.module.css";

type DialogMode = "view" | "edit" | "delete";

interface StudioCardDialogProps {
  card: StudioCard;
  summaries: SavedSummary[];
  annotations: Annotation[];
  initialMode: DialogMode;
  onCopy: (card: StudioCard) => void;
  onClose: () => void;
}

interface ViewProps {
  card: StudioCard;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CardView({ card, onCopy, onEdit, onDelete }: ViewProps) {
  return (
    <div className={styles.detailBody}>
      <div className={styles.contentBlock}>{card.content}</div>
      {card.quote ? <blockquote className={styles.quoteBlock}>{card.quote}</blockquote> : null}
      <DialogFooter>
        <Button asChild variant="outline" size="sm">
          <Link href={card.href}>
            <ExternalLink aria-hidden /> Open source
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          <Copy aria-hidden /> Copy
        </Button>
        <Button type="button" size="sm" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 aria-hidden /> Delete
        </Button>
      </DialogFooter>
    </div>
  );
}

interface EditProps {
  card: StudioCard;
  title: string;
  content: string;
  busy: boolean;
  error: string | null;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}

function CardEdit({
  card,
  title,
  content,
  busy,
  error,
  onTitleChange,
  onContentChange,
  onCancel,
  onSubmit,
}: EditProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {card.kind === "Summary" ? (
        <div className={styles.field}>
          <label htmlFor="studio-card-title">Title</label>
          <input
            id="studio-card-title"
            className={styles.input}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            autoFocus
          />
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="studio-card-content">{card.kind === "Summary" ? "Summary" : "Note"}</label>
        <textarea
          id="studio-card-content"
          className={styles.textarea}
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          autoFocus={card.kind === "Note"}
        />
      </div>
      {error ? (
        <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || !content.trim()}>
          {busy ? "Saving" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CardDelete({
  card,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  card: StudioCard;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.detailBody}>
      <p className={styles.deleteCopy}>
        {card.kind === "Summary"
          ? "The saved summary will be removed. The source document is not affected."
          : "The note and its conversation will be removed. The source document is not affected."}
      </p>
      {error ? (
        <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? "Deleting" : "Delete card"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function StudioCardDialog({
  card,
  summaries,
  annotations,
  initialMode,
  onCopy,
  onClose,
}: StudioCardDialogProps) {
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [draftTitle, setDraftTitle] = useState(card.title);
  const [draftContent, setDraftContent] = useState(card.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enterEdit() {
    setDraftTitle(card.title);
    setDraftContent(card.content);
    setError(null);
    setMode("edit");
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!draftContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (card.kind === "Summary") {
        const summary = summaries.find((item) => item.href === card.artifactId);
        if (!summary) throw new Error("Summary not found");
        await saveSummary({
          ...summary,
          title: draftTitle.trim() || summary.title,
          body: draftContent.trim(),
        });
      } else {
        const annotation = annotations.find((item) => item.id === card.artifactId);
        if (!annotation || !annotationNote(annotation).trim()) throw new Error("Note not found");
        await setAnnotationNote(annotation.id, draftContent.trim());
      }
      setMode("view");
      toast.success("Knowledge card updated");
    } catch {
      setError("The card could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      if (card.kind === "Summary") await deleteSummary(card.artifactId);
      else await deleteAnnotation(card.artifactId);
      toast.success("Knowledge card deleted");
      onClose();
    } catch {
      setError("The card could not be deleted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "edit"
      ? `Edit ${card.kind.toLocaleLowerCase()}`
      : mode === "delete"
        ? "Delete knowledge card?"
        : card.title;
  const description =
    mode === "edit"
      ? card.kind === "Summary"
        ? "Update the saved title and summary content."
        : "Notes use their text as the card title. The quoted passage stays attached."
      : mode === "delete"
        ? "This removes the saved artifact from Knowledge Studio."
        : `${card.kind} from the source document.`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {mode === "view" ? (
          <CardView
            card={card}
            onCopy={() => onCopy(card)}
            onEdit={enterEdit}
            onDelete={() => {
              setError(null);
              setMode("delete");
            }}
          />
        ) : mode === "edit" ? (
          <CardEdit
            card={card}
            title={draftTitle}
            content={draftContent}
            busy={busy}
            error={error}
            onTitleChange={setDraftTitle}
            onContentChange={setDraftContent}
            onCancel={() => setMode("view")}
            onSubmit={handleSave}
          />
        ) : (
          <CardDelete
            card={card}
            busy={busy}
            error={error}
            onCancel={() => setMode("view")}
            onConfirm={() => void handleDelete()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
