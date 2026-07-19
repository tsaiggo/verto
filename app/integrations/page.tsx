import type { Metadata } from "next";
import SourcesOverview, {
  type SourceRow,
  type SourceStatus,
} from "@/components/integrations/SourcesOverview";
import { getConnectionDetails } from "@/lib/connection-info";
import { listAllFiles } from "@/lib/content-source";

export const metadata: Metadata = {
  title: "Sources & Integrations",
  description: "Manage your local library, build source, and RSS feeds.",
};

interface SeedSource {
  kind: string;
  name: string;
  detail: string;
  lastSync: string;
  items: number;
  status: SourceStatus;
  progress?: number;
}

// Verto currently exposes two user-facing source types: Local Library for the
// library and RSS/Atom feeds for Inbox subscriptions. Keep this list honest so
// unsupported providers do not appear as connectable actions.
const SEED_SOURCES: SeedSource[] = [
  {
    kind: "local",
    name: "Local Library",
    detail: "Choose a folder",
    lastSync: "-",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "rss",
    name: "RSS",
    detail: "No feeds subscribed",
    lastSync: "-",
    items: 0,
    status: "disconnected",
  },
];

export default async function IntegrationsPage() {
  const connection = getConnectionDetails();

  // Reflect the real, active build source: mark its provider connected and
  // use its real name / location / item count where we can. A runtime local
  // folder can still replace this source in the desktop/web workbench.
  let realCount = 0;
  let readError: string | null = null;
  if (connection.connected) {
    try {
      realCount = (await listAllFiles()).filter((f) => !f.hidden).length;
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error);
    }
  }

  const sources: SourceRow[] = SEED_SOURCES.map((seed) => {
    if (connection.connected && seed.kind === connection.kind) {
      const detail = connection.path && connection.path !== "/" ? connection.path : seed.detail;
      return {
        kind: seed.kind,
        name: connection.name || seed.name,
        detail,
        lastSync: readError ? "Check failed" : "Just now",
        items: readError ? 0 : realCount || seed.items,
        status: (readError ? "disconnected" : "synced") as SourceStatus,
        sourceOrigin: connection.sourceOrigin,
        error: readError,
      };
    }
    return seed;
  });

  if (connection.kind === "onedrive") {
    sources.unshift({
      kind: "onedrive",
      name: connection.name || "OneDrive",
      detail: connection.path || "/",
      lastSync: readError
        ? "Check failed"
        : connection.connected
          ? "Ready at build"
          : "Not configured",
      items: readError ? 0 : realCount,
      status: readError || !connection.connected ? "disconnected" : "synced",
      sourceOrigin: connection.sourceOrigin,
      error: readError,
    });
  }

  return <SourcesOverview sources={sources} />;
}
