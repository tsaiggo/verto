import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import SourcesOverview, {
  type SourceRow,
  type SourceStatus,
} from "@/components/integrations/SourcesOverview";
import { getConnectionDetails } from "@/lib/connection-info";
import { listAllFiles } from "@/lib/content-source";

export const metadata: Metadata = {
  title: "Sources & Integrations",
  description: "Manage and monitor connected sources.",
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

// Verto static-first: only the local content source is available at build time.
// GitHub, OneDrive, and other remote providers need the desktop (Tauri) app
// or build-time environment variables — show them honestly as unavailable.
const SEED_SOURCES: SeedSource[] = [
  {
    kind: "local",
    name: "Local Library",
    detail: "/Users/alex/Verto",
    lastSync: "2m ago",
    items: 284,
    status: "synced",
  },
  {
    kind: "github",
    name: "GitHub",
    detail: "Available in the desktop app",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "onedrive",
    name: "OneDrive",
    detail: "Available in the desktop app",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "rss",
    name: "Web / RSS",
    detail: "Available in the desktop app",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "gdrive",
    name: "Google Drive",
    detail: "Not yet supported",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "notion",
    name: "Notion",
    detail: "Not yet supported",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "dropbox",
    name: "Dropbox",
    detail: "Not yet supported",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
];

export default async function IntegrationsPage() {
  const connection = getConnectionDetails();

  // Reflect the real, active content source: mark its provider connected and
  // use its real name / location / item count where we can.
  let realCount = 0;
  if (connection.connected) {
    try {
      realCount = (await listAllFiles()).filter((f) => !f.hidden).length;
    } catch {
      realCount = 0;
    }
  }

  const sources: SourceRow[] = SEED_SOURCES.map((seed) => {
    if (connection.connected && seed.kind === connection.kind) {
      const detail = connection.repo
        ? connection.branch
          ? `${connection.repo} · ${connection.branch}`
          : connection.repo
        : connection.path && connection.path !== "/"
          ? connection.path
          : seed.detail;
      return {
        kind: seed.kind,
        name: connection.name || seed.name,
        detail,
        lastSync: "Just now",
        items: realCount || seed.items,
        status: "synced" as SourceStatus,
      };
    }
    return seed;
  });

  return (
    <>
      <PageHeader
        title="Sources & Integrations"
        subtitle="Manage and monitor connected sources."
        tools={
          <Link href="/integrations/connect" className="v-btn v-btn--primary v-btn--sm">
            Add Source
          </Link>
        }
      />
      <SourcesOverview sources={sources} />
    </>
  );
}
