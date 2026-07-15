import type { SummaryDocRef } from "@/lib/summaries";

const PREVIEW_LIMIT = 180;
const WRITE_ACTIONS: Record<string, string> = {
  create_highlight_note: "Save a highlight & note",
  save_summary: "Save a summary to your library",
};

export interface PendingWritePreview {
  valid: boolean;
  action: string;
  targetTitle?: string;
  targetHref?: string;
  fields: Array<{ label: string; value: string }>;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clipped(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= PREVIEW_LIMIT
    ? normalized
    : `${normalized.slice(0, PREVIEW_LIMIT).trimEnd()}…`;
}

function invalid(action: string, error: string): PendingWritePreview {
  return { valid: false, action, fields: [], error };
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseArgs(rawArgs: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(rawArgs);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function summaryPreview(
  action: string,
  value: Record<string, unknown>,
  doc: SummaryDocRef
): PendingWritePreview {
  if (!hasOnlyKeys(value, ["body"]) || typeof value.body !== "string" || !value.body.trim()) {
    return invalid(action, "The summary payload could not be verified.");
  }
  return {
    valid: true,
    action,
    targetTitle: doc.title,
    targetHref: doc.href,
    fields: [{ label: "Summary", value: clipped(value.body) }],
  };
}

function highlightPreview(
  action: string,
  value: Record<string, unknown>,
  doc: SummaryDocRef
): PendingWritePreview {
  const noteIsValid =
    value.note === undefined || (typeof value.note === "string" && value.note.trim() !== "");
  if (
    !hasOnlyKeys(value, ["quote", "note"]) ||
    typeof value.quote !== "string" ||
    !value.quote.trim() ||
    !noteIsValid
  ) {
    return invalid(action, "The highlight payload could not be verified.");
  }
  return {
    valid: true,
    action,
    targetTitle: doc.title,
    targetHref: doc.href,
    fields: [
      { label: "Quote", value: clipped(value.quote) },
      ...(typeof value.note === "string" ? [{ label: "Note", value: clipped(value.note) }] : []),
    ],
  };
}

/**
 * Parse exactly the write payload that will be approved by the reader.
 * Unknown, hidden, or malformed fields make the request non-approvable.
 */
export function pendingWritePreview(
  name: string,
  rawArgs: string,
  doc?: SummaryDocRef
): PendingWritePreview {
  const action = WRITE_ACTIONS[name] ?? "Unsupported write request";

  if (!doc || !doc.title.trim() || !doc.href.trim()) {
    return invalid(action, "No target document is open, so this request cannot be verified.");
  }

  const value = parseArgs(rawArgs);
  if (!value) {
    return invalid(action, "The assistant supplied malformed arguments. This request cannot run.");
  }

  if (name === "save_summary") {
    return summaryPreview(action, value, doc);
  }

  if (name === "create_highlight_note") {
    return highlightPreview(action, value, doc);
  }

  return invalid(action, "This write action is not supported and cannot be approved.");
}
