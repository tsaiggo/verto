import { deleteAnnotation, loadAnnotations, type Annotation } from "@/lib/annotations";
import {
  deleteSummary,
  findSummary,
  loadSummaries,
  saveSummary,
  type SavedSummary,
} from "@/lib/summaries";

export type MutationReceipt =
  | {
      kind: "annotation.create";
      after: Annotation;
      createdAt: string;
      undoneAt?: string;
    }
  | {
      kind: "summary.upsert";
      before: SavedSummary | null;
      after: SavedSummary;
      createdAt: string;
      undoneAt?: string;
    };

export type MutationUndoResult =
  | { ok: true; receipt: MutationReceipt }
  | { ok: false; error: string };

function unchanged<T>(current: T | null | undefined, expected: T): boolean {
  return current != null && JSON.stringify(current) === JSON.stringify(expected);
}

/**
 * Reverse an Agent write only while the written value still matches its
 * receipt. A later human edit wins; Verto never overwrites it during Undo.
 */
export async function undoMutationReceipt(receipt: MutationReceipt): Promise<MutationUndoResult> {
  if (receipt.undoneAt) return { ok: false, error: "This change was already undone." };

  if (receipt.kind === "annotation.create") {
    const current = loadAnnotations().annotations.find((item) => item.id === receipt.after.id);
    if (!unchanged(current, receipt.after)) {
      return {
        ok: false,
        error: "The highlight changed after it was created, so it cannot be safely undone.",
      };
    }
    await deleteAnnotation(receipt.after.id);
  } else {
    const current = findSummary(loadSummaries().summaries, receipt.after.href);
    if (!unchanged(current, receipt.after)) {
      return {
        ok: false,
        error: "The summary changed after it was saved, so it cannot be safely undone.",
      };
    }
    if (receipt.before) await saveSummary(receipt.before);
    else await deleteSummary(receipt.after.href);
  }

  return {
    ok: true,
    receipt: { ...receipt, undoneAt: new Date().toISOString() },
  };
}
