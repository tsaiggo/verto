"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listImportedDocuments,
  subscribeImportedDocuments,
  type ImportedDocument,
} from "@/lib/imported-documents";

export function useImportedDocuments() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    documents: ImportedDocument[];
    status: "loading" | "ready" | "error";
    error: string | null;
  }>({ documents: [], status: "loading", error: null });
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const refresh = () => {
      const request = ++sequence;
      void listImportedDocuments().then(
        (documents) => {
          if (active && request === sequence) setState({ documents, status: "ready", error: null });
        },
        (error: unknown) => {
          if (active && request === sequence)
            setState((previous) => ({
              ...previous,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            }));
        }
      );
    };
    const unsubscribe = subscribeImportedDocuments(refresh);
    queueMicrotask(refresh);
    return () => {
      active = false;
      sequence++;
      unsubscribe();
    };
  }, [revision]);
  return { ...state, retry };
}
