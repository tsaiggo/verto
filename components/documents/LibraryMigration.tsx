"use client";

import { useRef, useState } from "react";
import { migrateBrowserLibraryToNative } from "@/lib/library-migration";
import { isTauri } from "@/lib/tauri";
import styles from "@/components/library/Library.module.css";

export default function LibraryMigration() {
  const busy = useRef(false);
  const [state, setState] = useState<{ pending: boolean; message: string | null; error: boolean }>({
    pending: false,
    message: null,
    error: false,
  });
  if (!isTauri()) return null;
  async function copyPreviousLibrary() {
    if (busy.current) return;
    busy.current = true;
    setState({ pending: true, message: null, error: false });
    try {
      const result = await migrateBrowserLibraryToNative();
      setState({
        pending: false,
        error: false,
        message: `${result.articlesCopied} articles and ${result.documentsCopied} books copied. ${result.alreadyPresent} items were already present. The previous library is preserved.`,
      });
    } catch (error) {
      setState({
        pending: false,
        error: true,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      busy.current = false;
    }
  }
  return (
    <div className={styles.browserNotice}>
      <div>
        <strong>Previous app library</strong>
        <p>
          Copy articles and books previously saved in this desktop app’s browser storage into
          application data.
        </p>
        {state.message ? <p role={state.error ? "alert" : "status"}>{state.message}</p> : null}
      </div>
      <button type="button" disabled={state.pending} onClick={() => void copyPreviousLibrary()}>
        {state.pending ? "Copying…" : "Copy previous library"}
      </button>
    </div>
  );
}
