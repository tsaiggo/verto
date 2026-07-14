"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { reconcileNativeLocalFolder } from "@/lib/state-store";
import { isTauri } from "@/lib/tauri";

/** Restore the renderer's active root from the native authorization registry. */
export default function NativeLocalFolderReconciler() {
  useEffect(() => {
    if (!isTauri()) return;

    let mounted = true;
    void reconcileNativeLocalFolder().catch((error: unknown) => {
      if (!mounted) return;
      console.error("[StateStore] Could not reconcile the active native library.", error);
      toast.error("Couldn’t restore the active local library", {
        id: "native-library-reconciliation",
        description: "Reconnect the library from Sources to restore its portable state.",
        duration: 8000,
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
