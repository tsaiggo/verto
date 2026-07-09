"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { isTauri } from "@/lib/tauri";

interface UpdateCheckButtonProps {
  className?: string;
  children?: ReactNode;
  checkingChildren?: ReactNode;
  title?: string;
  "aria-label"?: string;
}

export default function UpdateCheckButton({
  className,
  children = "Check for updates",
  checkingChildren,
  title = "Check for updates",
  "aria-label": ariaLabel = "Check for updates",
}: UpdateCheckButtonProps) {
  const [checking, setChecking] = useState(false);

  async function checkForUpdate() {
    if (checking) return;

    if (!isTauri()) {
      toast("Update checks are available in the Verto desktop app.");
      return;
    }

    setChecking(true);
    const checkingToast = toast.loading("Checking for updates...");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      const update = await check();
      if (!update) {
        toast.success("Verto is up to date.", { id: checkingToast });
        return;
      }

      let downloaded = 0;
      let total = 0;
      toast.loading(`Downloading update ${update.version}...`, { id: checkingToast });

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) {
              const pct = Math.min(100, Math.round((downloaded / total) * 100));
              toast.loading(`Downloading update ${update.version}... ${pct}%`, {
                id: checkingToast,
              });
            }
            break;
          case "Finished":
            toast.success("Update installed. Restarting...", { id: checkingToast });
            break;
        }
      });

      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Update check failed: ${message}`, { id: checkingToast });
    } finally {
      setChecking(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={checkForUpdate}
      disabled={checking}
      aria-busy={checking}
    >
      {checking ? (checkingChildren ?? children) : children}
    </button>
  );
}
