'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Returns true when the page is running inside the Tauri runtime
// (the desktop shell), false in the browser. Tauri 2 exposes
// `__TAURI_INTERNALS__`; we look for either marker for safety.
function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

/**
 * Floating "check for updates" trigger.
 *
 * Renders nothing in the web build — the component is mounted in the
 * shared layout but bails out of `render` unless it detects the Tauri
 * runtime, so the desktop-only deps (`@tauri-apps/plugin-updater`,
 * `@tauri-apps/plugin-process`) are loaded lazily and never block the
 * static export bundle.
 */
export default function UpdateCheck() {
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isTauri()) return null;

  async function checkForUpdate() {
    if (checking) return;
    setChecking(true);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();
      if (!update) {
        toast.success('You are on the latest version.');
        return;
      }

      const toastId = toast.loading(
        `Downloading update ${update.version}…`,
      );
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) {
              const pct = Math.min(100, Math.round((downloaded / total) * 100));
              toast.loading(`Downloading update ${update.version}… ${pct}%`, {
                id: toastId,
              });
            }
            break;
          case 'Finished':
            toast.success('Update installed. Restarting…', { id: toastId });
            break;
        }
      });

      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Update failed: ${message}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Check for updates"
      title="Check for updates"
      onClick={checkForUpdate}
      disabled={checking}
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
