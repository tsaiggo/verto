"use client";

import { Loader2 } from "lucide-react";
import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import styles from "@/components/collections/Collections.module.css";

interface CollectionDialogProps {
  open: boolean;
  title: string;
  description: string;
  label: string;
  inputId: string;
  name: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function CollectionDialog({
  open,
  title,
  description,
  label,
  inputId,
  name,
  submitLabel,
  pendingLabel,
  pending,
  error,
  onNameChange,
  onOpenChange,
  onSubmit,
}: CollectionDialogProps) {
  const errorId = `${inputId}-error`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className={styles.dialogForm} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label htmlFor={inputId}>{label}</label>
            <input
              id={inputId}
              className={styles.input}
              value={name}
              placeholder="Research queue"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={pending}
              autoFocus
              onChange={(event) => onNameChange(event.target.value)}
            />
            {error ? (
              <p id={errorId} className={styles.fieldError} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? (
                <>
                  <Loader2 className={styles.spinner} aria-hidden />
                  {pendingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
