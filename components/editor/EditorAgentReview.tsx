"use client";

import Link from "next/link";
import { Bot, Check, Info, RotateCcw, SendHorizontal, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  defaultEditorSuggestionClient,
  type EditorEditProposal,
  type EditorSuggestionAvailability,
  type EditorSuggestionClient,
} from "./editor-ai-suggestion";
import styles from "./EditorAgentReview.module.css";

const MAX_INSTRUCTION_LENGTH = 1_200;

interface AppliedEditReceipt {
  beforeSource: string;
  afterSource: string;
  appliedRevision: number;
  summary: string;
  undone: boolean;
}

export interface EditorAgentReviewProps {
  source: string;
  format: "md" | "mdx";
  filename: string;
  revision: number;
  onApply: (source: string) => void;
  client?: EditorSuggestionClient;
  disabled?: boolean;
  persistenceMode?: "disk" | "download";
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The suggestion could not be generated. Try again.";
}

function impactLabel(proposal: EditorEditProposal): string {
  const lineRange =
    proposal.startLine === proposal.endLine
      ? `line ${proposal.startLine}`
      : `lines ${proposal.startLine}-${proposal.endLine}`;
  return `${lineRange} · +${proposal.addedLineCount} / −${proposal.removedLineCount}`;
}

// eslint-disable-next-line complexity, max-lines-per-function -- One controller keeps request capture, explicit approval, stale-patch rejection, and revision-safe undo in a single auditable state machine.
export function EditorAgentReview({
  source,
  format,
  filename,
  revision,
  onApply,
  client = defaultEditorSuggestionClient,
  disabled = false,
  persistenceMode = "disk",
}: EditorAgentReviewProps) {
  const instructionId = useId();
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const previousFilename = useRef(filename);
  const [availability, setAvailability] = useState<
    EditorSuggestionAvailability | { kind: "checking" }
  >({ kind: "checking" });
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<EditorEditProposal | null>(null);
  const [receipt, setReceipt] = useState<AppliedEditReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAvailability({ kind: "checking" });
    void Promise.resolve()
      .then(() => client.availability())
      .then((next) => {
        if (!cancelled) setAvailability(next);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({
            kind: "unconfigured",
            message: "Verto could not read the AI provider settings.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (previousFilename.current === filename) return;
    previousFilename.current = filename;
    requestSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setProposal(null);
    setReceipt(null);
    setError("");
    setNotice("The file changed. Request a new suggestion for this draft.");
  }, [filename]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
      abortRef.current?.abort();
    },
    []
  );

  const proposalConflict =
    proposal !== null &&
    (source !== proposal.beforeSource ||
      revision !== proposal.baseRevision ||
      filename !== proposal.filename ||
      format !== proposal.format);
  const undoConflict =
    receipt !== null &&
    !receipt.undone &&
    (source !== receipt.afterSource || revision !== receipt.appliedRevision);
  const canRequest =
    availability.kind === "ready" && !disabled && !isLoading && instruction.trim().length > 0;

  async function handleRequest() {
    if (!canRequest) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const input = {
      source,
      instruction: instruction.trim(),
      filename,
      format,
      revision,
    };

    setIsLoading(true);
    setProposal(null);
    setError("");
    setNotice("");
    try {
      const nextProposal = await client.request(input, controller.signal);
      if (requestSequence.current !== sequence || controller.signal.aborted) return;
      setProposal(nextProposal);
    } catch (requestError) {
      if (requestSequence.current !== sequence || controller.signal.aborted) return;
      setError(errorMessage(requestError));
    } finally {
      if (requestSequence.current === sequence) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function handleCancel() {
    requestSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setNotice("Suggestion request cancelled. The draft was not changed.");
  }

  function handleReject() {
    setProposal(null);
    setError("");
    setNotice("Suggestion rejected. The draft was not changed.");
  }

  function handleApprove() {
    if (!proposal || proposalConflict) return;
    onApply(proposal.afterSource);
    setReceipt({
      beforeSource: proposal.beforeSource,
      afterSource: proposal.afterSource,
      appliedRevision: proposal.baseRevision + 1,
      summary: proposal.summary,
      undone: false,
    });
    setProposal(null);
    setError("");
    setNotice("");
  }

  function handleUndo() {
    if (!receipt || receipt.undone || undoConflict) return;
    onApply(receipt.beforeSource);
    setReceipt({ ...receipt, undone: true });
    setNotice("Agent edit undone in the current draft. Saving is still separate.");
  }

  return (
    <aside className={styles.panel} aria-labelledby={`${instructionId}-title`}>
      <header className={styles.header}>
        <span className={styles.agentIcon} aria-hidden>
          <Bot />
        </span>
        <div>
          <h2 id={`${instructionId}-title`}>Edit with Agent</h2>
          <p>Review every change before it reaches your draft.</p>
        </div>
      </header>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleRequest();
        }}
      >
        <label htmlFor={instructionId}>What should change?</label>
        <textarea
          id={instructionId}
          value={instruction}
          maxLength={MAX_INSTRUCTION_LENGTH}
          rows={4}
          placeholder="Tighten the introduction while keeping the original meaning."
          onChange={(event) => setInstruction(event.currentTarget.value)}
          aria-describedby={`${instructionId}-scope ${instructionId}-count`}
          disabled={disabled}
        />
        <div className={styles.formMeta}>
          <span>Current {format.toUpperCase()} draft</span>
          <span id={`${instructionId}-count`}>
            {instruction.length}/{MAX_INSTRUCTION_LENGTH}
          </span>
        </div>
        <div className={styles.requestActions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!canRequest}
            aria-describedby={availability.kind === "ready" ? undefined : `${instructionId}-setup`}
          >
            <SendHorizontal aria-hidden />
            {isLoading ? "Reviewing…" : "Review suggestion"}
          </button>
          {isLoading ? (
            <button type="button" className={styles.textButton} onClick={handleCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <p className={styles.scope} id={`${instructionId}-scope`}>
        <Info aria-hidden />
        The request and current draft are sent to your configured provider. Applying the suggestion
        changes only this draft; saving or downloading remains explicit.
      </p>

      {availability.kind === "checking" ? (
        <p className={styles.status} id={`${instructionId}-setup`} role="status">
          Checking provider settings…
        </p>
      ) : availability.kind !== "ready" ? (
        <div className={styles.setup} id={`${instructionId}-setup`}>
          <p>
            <TriangleAlert aria-hidden />
            <span>{availability.message}</span>
          </p>
          <Link href="/settings/agent">Open AI &amp; Agent settings</Link>
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <span />
          <span />
          <span />
          <p>Comparing the request with this exact draft…</p>
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          <TriangleAlert aria-hidden />
          <div>
            <strong>Suggestion unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {proposal ? (
        <section className={styles.review} aria-label="Agent edit review">
          <div className={styles.reviewHeader}>
            <div>
              <span>Suggested edit</span>
              <h3>{proposal.summary}</h3>
            </div>
            <code>{impactLabel(proposal)}</code>
          </div>

          {proposalConflict ? (
            <div className={styles.conflict} role="alert">
              <TriangleAlert aria-hidden />
              <p>
                This draft changed after the suggestion was requested. Reject it and request a fresh
                edit so newer work is preserved.
              </p>
            </div>
          ) : null}

          <pre className={styles.diff} aria-label="Proposed source diff">
            <code>
              {proposal.diffLines.map((line, index) => (
                <span
                  className={line.kind === "added" ? styles.addedLine : styles.removedLine}
                  key={`${line.kind}-${index}`}
                >
                  <span aria-hidden>{line.kind === "added" ? "+" : "−"}</span>
                  {line.value || " "}
                </span>
              ))}
            </code>
          </pre>

          <div className={styles.reviewActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleApprove}
              disabled={proposalConflict}
            >
              <Check aria-hidden />
              Approve and apply
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleReject}>
              <X aria-hidden />
              Reject
            </button>
          </div>
        </section>
      ) : null}

      {receipt && !receipt.undone && !proposal ? (
        <section className={styles.receipt} aria-label="Applied agent edit">
          <div>
            <Check aria-hidden />
            <p>
              <strong>
                {undoConflict ? "Agent edit applied earlier" : "Applied to current draft"}
              </strong>
              <span>
                {receipt.summary}.
                {!undoConflict ? (
                  <>
                    {" "}
                    {persistenceMode === "disk"
                      ? "Agent approval did not save this edit to disk; use Save separately."
                      : "Agent approval did not download this version; use Download separately."}
                  </>
                ) : null}
              </span>
            </p>
          </div>
          {undoConflict ? (
            <p className={styles.undoConflict} role="status">
              Undo is unavailable because the draft changed afterward. Your newer edits are
              preserved.
            </p>
          ) : null}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleUndo}
            disabled={undoConflict}
          >
            <RotateCcw aria-hidden />
            Undo agent edit
          </button>
        </section>
      ) : null}

      {notice ? (
        <p className={styles.notice} role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
    </aside>
  );
}
