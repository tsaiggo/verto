// Managed-library annotations need durable native storage so the read-only
// MCP companion can retrieve them while the desktop window is closed.
import { createWebStore } from "./web";
import type { StateStore } from "./types";
import { STATE_STORE_ERROR_EVENT } from "./local-folder";

interface AnnotationFileSystem {
  read(): Promise<unknown | null>;
  write(value: unknown): Promise<void>;
}

const NAME = "annotations";
const CACHE_NAME = "app-annotations";
const EMPTY = { annotations: [] };

async function nativeFileSystem(): Promise<AnnotationFileSystem> {
  const { tauriInvoke } = await import("@/lib/tauri");
  return {
    read: () => tauriInvoke("read_agent_annotations"),
    write: (value) => tauriInvoke("write_agent_annotations", { value }),
  };
}

function validState(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    "annotations" in value &&
    Array.isArray(value.annotations)
  );
}

export function createDesktopAppStore(fileSystem?: AnnotationFileSystem): StateStore {
  const web = createWebStore();
  let hydration: Promise<void> | undefined;
  let ready = false;
  let queue: Promise<unknown> = Promise.resolve();
  const loadFs = () => (fileSystem ? Promise.resolve(fileSystem) : nativeFileSystem());

  function hydrate(): Promise<void> {
    if (hydration) return hydration;
    hydration = (async () => {
      const fs = await loadFs();
      let value = await fs.read();
      if (value === null) {
        // Never migrate the shared cache when it belongs to a different vault.
        const origin =
          typeof window === "undefined"
            ? null
            : window.localStorage?.getItem("verto:state-store-origin:annotations");
        const cached = web.read<unknown>(CACHE_NAME, null);
        const legacy = !origin ? web.read<unknown>(NAME, null) : null;
        value = validState(cached) ? cached : validState(legacy) ? legacy : EMPTY;
        await fs.write(value);
      }
      if (!validState(value)) throw new Error("Saved desktop annotations are invalid.");
      web.write(CACHE_NAME, value);
      ready = true;
    })();
    void hydration.catch(() => {
      hydration = undefined;
    });
    return hydration;
  }

  function report(error: unknown) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(STATE_STORE_ERROR_EVENT, {
        detail: {
          operation: "update",
          folder: "Desktop library",
          name: NAME,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    );
  }

  const store: StateStore = {
    read<T>(name: string, fallback: T): T {
      if (name !== NAME) return web.read(name, fallback);
      void hydrate().catch(report);
      return ready ? web.read(CACHE_NAME, fallback) : fallback;
    },
    hydrate(name) {
      return name === NAME ? hydrate() : Promise.resolve();
    },
    update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      if (name !== NAME) return web.update(name, fallback, updater);
      const pending = queue
        .catch(() => {})
        .then(async () => {
          await hydrate();
          const next = updater(web.read(CACHE_NAME, fallback));
          if (!validState(next))
            throw new Error("Desktop annotations must contain an annotations list.");
          await (await loadFs()).write(next);
          web.write(CACHE_NAME, next);
          return next;
        });
      queue = pending;
      return pending;
    },
    write(name, value) {
      if (name !== NAME) web.write(name, value);
      else void store.update<unknown>(name, EMPTY, () => value).catch(report);
    },
    subscribe: web.subscribe,
  };
  return store;
}
