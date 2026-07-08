// Desktop backend for the StateStore abstraction.
//
// Uses the web (localStorage) backend as the synchronous primary store for
// instant reads and same-tab reactivity, then asynchronously mirrors every
// write to <activeFolder>/.verto/<name>.json so state travels with the vault.
//
// The async mirror is fire-and-forget and wrapped in try/catch — .verto/
// writes are best-effort and never block the UI or surface errors to the user.

import { loadActiveLocalFolder } from "@/lib/local-folder";

import { createWebStore } from "./web";
import type { StateStore } from "./types";

async function mirrorToDisk(folder: string, name: string, json: string): Promise<void> {
  try {
    const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
    const dir = `${folder}/.verto`;
    await mkdir(dir, { recursive: true });
    await writeTextFile(`${dir}/${name}.json`, json);
  } catch {
    // Best-effort: .verto/ writes never break the UI.
  }
}

export function createLocalFolderStore(): StateStore {
  const web = createWebStore();

  return {
    read<T>(name: string, fallback: T): T {
      return web.read(name, fallback);
    },

    write<T>(name: string, value: T): void {
      web.write(name, value);
      const folder = loadActiveLocalFolder();
      if (folder !== null) {
        void mirrorToDisk(folder, name, JSON.stringify(value));
      }
    },

    subscribe(listener: () => void): () => void {
      return web.subscribe(listener);
    },
  };
}
