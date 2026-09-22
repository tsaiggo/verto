"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import styles from "./CreateDialog.module.css";

/**
 * Props for CreateDialog — ported from design-labs workspace WorkspaceSidebar
 * openCreate / submitCreate pattern. Intentionally controlled so the
 * integration layer (e.g. LibraryBrowser wiring) owns `target` + creation
 * persistence; this component only handles input constraints, duplicate
 * feedback, focus trap/restore, and backdrop/Esc closing.
 *
 * Wire to LabsSidebar:
 *   const [createTarget, setCreateTarget] = useState<string | null>(null);
 *   const lastCreateTrigger = useRef<HTMLElement | null>(null);
 *   const openCreate = (groupId: string) => {
 *     lastCreateTrigger.current = document.activeElement as HTMLElement;
 *     setCreateTarget(groupId);
 *   };
 *   <LabsSidebar tree={tree} onCreate={openCreate} ... />
 *   <CreateDialog
 *     open={createTarget !== null}
 *     target={createTarget}
 *     onClose={() => setCreateTarget(null)}
 *     onCreate={(name, target) => { ... in-memory or persisted ...; return !duplicate }}
 *     existingNames={existingNamesForTarget(createTarget)}
 *     triggerRef={lastCreateTrigger}
 *   />
 *
 * Do NOT persist mocks to prod — caller decides persistence.
 */
export interface CreateDialogProps {
  open: boolean;
  target: string | null;
  onClose: () => void;
  /** Return true on success, false if duplicate (caller may also be async) */
  onCreate: (name: string, target: string) => boolean | Promise<boolean>;
  /** Names considered duplicate for the current target (case-insensitive trimmed compare) */
  existingNames?: string[];
  /** Ref to the element that opened the dialog; focus returns here on close */
  triggerRef?: React.MutableRefObject<HTMLElement | null>;
  /** Optional explicit autofocus target; defaults to internal input */
}

const CREATE_MAX_LENGTH = 60;

function isDuplicate(name: string, existing: string[]): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return existing.some((e) => e.trim().toLowerCase() === needle);
}

function targetTitle(target: string | null): string {
  if (!target) return "New item";
  if (target.toLowerCase() === "projects") return "New project";
  if (target.toLowerCase() === "workspace") return "New page";
  // For LabsSidebar groups, title is label-like; keep generic
  return `New in ${target}`;
}

export default function CreateDialog({
  open,
  target,
  onClose,
  onCreate,
  existingNames = [],
  triggerRef,
}: CreateDialogProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const internalTriggerRef = useRef<HTMLElement | null>(null);
  const getActiveTrigger = useCallback(
    () => triggerRef?.current ?? internalTriggerRef.current,
    [triggerRef]
  );

  useEffect(() => {
    if (!open) return;
    if (!triggerRef?.current && !internalTriggerRef.current) {
      internalTriggerRef.current = document.activeElement as HTMLElement;
    }
    queueMicrotask(() => {
      setName("");
      setTouched(false);
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, triggerRef]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
        requestAnimationFrame(() => {
          getActiveTrigger()?.focus();
        });
      }
    },
    [onClose, getActiveTrigger]
  );

  const trimmed = name.trim();
  const duplicate = isDuplicate(trimmed, existingNames);
  const empty = trimmed.length === 0;
  const canSubmit = !empty && !duplicate;

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!canSubmit || !target) return;
      const ok = await onCreate(trimmed, target);
      if (!ok) {
        // Caller signalled duplicate (race) — show error
        setTouched(true);
        return;
      }
      onClose();
      requestAnimationFrame(() => getActiveTrigger()?.focus());
    },
    [canSubmit, target, onCreate, trimmed, onClose, getActiveTrigger]
  );

  const handleEscape = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // Also restore focus on unmount / close via dialog onClose
  const handleOverlayClick = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={styles.overlay}
          onClick={handleOverlayClick}
          data-testid="create-dialog-overlay"
        />
        <Dialog.Content
          className={styles.content}
          aria-describedby="create-dialog-description"
          onEscapeKeyDown={handleEscape}
          onPointerDownOutside={handleEscape}
          data-testid="create-dialog-content"
        >
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{targetTitle(target)}</Dialog.Title>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Cancel creation"
              onClick={() => handleOpenChange(false)}
              data-testid="create-dialog-close"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <Dialog.Description id="create-dialog-description" className={styles.description}>
            Add to {target ?? "Workspace"}. This preview keeps changes until you reload.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="create-dialog-name" className={styles.label}>
              Name
            </label>
            <input
              id="create-dialog-name"
              ref={inputRef}
              className={styles.input}
              maxLength={CREATE_MAX_LENGTH}
              value={name}
              onChange={(e) => {
                // Enforce maxLength programmatically as well (handles paste / IME)
                const v = e.target.value.slice(0, CREATE_MAX_LENGTH);
                setName(v);
                if (!touched) setTouched(true);
              }}
              placeholder={target === "Projects" ? "e.g. Studio website" : "Give it a name"}
              aria-invalid={duplicate ? "true" : undefined}
              aria-describedby={duplicate ? "create-name-error" : undefined}
              data-testid="create-dialog-input"
              autoComplete="off"
              spellCheck={false}
              required
            />
            {duplicate ? (
              <span
                id="create-name-error"
                className={styles.nameError}
                role="status"
                data-testid="create-name-error"
              >
                This name already exists.
              </span>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => handleOpenChange(false)}
                data-testid="create-dialog-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={!canSubmit}
                aria-disabled={!canSubmit ? "true" : undefined}
                data-testid="create-dialog-submit"
              >
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Re-export helper for tests / callers that need to validate externally
export { CREATE_MAX_LENGTH, isDuplicate };
