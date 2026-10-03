"use client";

import Link from "next/link";
import { useRef } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importedDocumentHref } from "@/lib/imported-documents";
import type { DocumentImportState } from "./useDocumentImport";
import styles from "@/components/library/Library.module.css";

export function DocumentImportButton({
  state,
  onImport,
}: {
  state: DocumentImportState;
  onImport: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pending = state.status === "reading" || state.status === "saving";
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        aria-label="Import EPUB or PDF file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onImport(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className={styles.sourceButton}
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? <Loader2 className={styles.spinner} aria-hidden /> : <FileUp aria-hidden />}
        Import book
      </Button>
    </>
  );
}

export function DocumentImportNotice({
  state,
  onDismiss,
}: {
  state: DocumentImportState;
  onDismiss: () => void;
}) {
  if (state.status === "idle") return null;
  const pending = state.status === "reading" || state.status === "saving";
  return (
    <div className={styles.browserNotice} role={state.status === "error" ? "alert" : "status"}>
      <div>
        <strong>
          {state.status === "saved"
            ? `${state.document.title} imported`
            : state.status === "error"
              ? `${state.filename} couldn’t be imported`
              : `${state.status === "reading" ? "Reading" : "Saving"} ${state.filename}…`}
        </strong>
        <p>
          {state.status === "error"
            ? state.error
            : state.status === "saved"
              ? "The original file is kept in your local library."
              : "Keep this page open until the file is saved."}
        </p>
      </div>
      {state.status === "saved" ? (
        <Link href={importedDocumentHref(state.document.id)}>Open book</Link>
      ) : null}
      {!pending ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss import notice">
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
